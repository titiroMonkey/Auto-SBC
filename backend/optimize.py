import time
import os
from threading import Timer, Lock

from logger import add_log  # Import the add_log function from globals
from ortools.sat.python import cp_model
import pandas as pd


_active_solver_lock = Lock()
_active_solver = None


def register_active_solver(solver):
    global _active_solver
    with _active_solver_lock:
        _active_solver = solver


def clear_active_solver(solver=None):
    global _active_solver
    with _active_solver_lock:
        if solver is None or _active_solver is solver:
            _active_solver = None


def request_cancel_active_solve() -> bool:
    with _active_solver_lock:
        solver = _active_solver

    if solver is None:
        return False

    try:
        solver.StopSearch()
        add_log("Received newer solve request: stopping active solve")
        return True
    except Exception as exc:
        add_log(f"Failed to stop active solve: {exc}")
        return False


def runtime(func):
    """Wrapper function to log the execution time"""

    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        seconds = round(time.time() - start, 2)
        print(f"Processing time {func.__name__}: {seconds} seconds")
        add_log(f"Processing time {func.__name__}: {seconds} seconds")
        return result

    return wrapper


class SolutionCallback(cp_model.CpSolverSolutionCallback):
    """Stop the search if the objective remains the same for X seconds"""

    def __init__(
        self,
        timer_limit: int,
        player,
        player_ids,
        player_definition_ids,
        df,
        emit_interval_seconds: float = 2.0,
        include_interim_results: bool = False,
        formation=None,
    ):
        super().__init__()
        self._timer_limit = timer_limit
        self._timer = None
        self._player = player
        self._player_ids = player_ids
        self._player_definition_ids = player_definition_ids
        self._df = df
        self._emit_interval_seconds = max(0.0, float(emit_interval_seconds))
        self._include_interim_results = bool(include_interim_results)
        self._formation_set = set(formation or [])
        self._last_emit_ts = 0.0
        self.solutions = []  # Add this to store solutions
        self.solution_count = 0

    def on_solution_callback(self):
        """This is called everytime a solution with better objective is found."""
        self.solution_count += 1
        objective_value = self.ObjectiveValue()
        now_ts = time.time()
        should_emit = (
            self.solution_count == 1
            or self._emit_interval_seconds == 0
            or (now_ts - self._last_emit_ts) >= self._emit_interval_seconds
        )

        # Store solution details
        solution_info = {
            "solution_number": self.solution_count,
            "objective_value": objective_value,
            "time": time.time(),
        }

        # Add selected players to solution info
        selected_players = []
        for i in range(len(self._player)):
            if self.Value(self._player[i]) == 1:
                selected_players.append(i)
        selected_player_ids = [self._player_ids[i] for i in selected_players]
        selected_definition_ids = [
            self._player_definition_ids[i] for i in selected_players
        ]

        interim_results = None
        if should_emit and self._include_interim_results:
            interim_df = self._df.iloc[selected_players].copy()
            # Compute Is_Pos the same way the final solution does so the
            # frontend can place position-matched players into their correct
            # formation slots (Is_Pos=1) instead of first-available fill-ins.
            if "possiblePositions" in interim_df.columns and self._formation_set:
                interim_df["Is_Pos"] = interim_df["possiblePositions"].apply(
                    lambda pos: 1 if pos in self._formation_set else 0
                )
            elif "Is_Pos" not in interim_df.columns:
                interim_df["Is_Pos"] = 0
            interim_results = interim_df.to_json(orient="records")

        solution_info["selected_players"] = selected_players
        solution_info["selected_player_ids"] = selected_player_ids
        solution_info["selected_definition_ids"] = selected_definition_ids
        if interim_results is not None:
            solution_info["results"] = interim_results

        if should_emit:
            self._last_emit_ts = now_ts
            result_payload = {
                "event": "interim_solution",
                "solution_number": self.solution_count,
                "objective_value": objective_value,
                "selected_player_ids": selected_player_ids,
                "selected_definition_ids": selected_definition_ids,
                "status": "FEASIBLE: Interim solution found",
                "status_code": 2,
            }
            if interim_results is not None:
                result_payload["results"] = interim_results
            add_log(
                f"Solution {self.solution_count} found with objective value: {objective_value}",
                result_payload,
            )
            self.solutions.append(solution_info)

        self._reset_timer()

    def _reset_timer(self):
        if self._timer:
            self._timer.cancel()
        self._timer = Timer(self._timer_limit, self.StopSearch)
        self._timer.start()

    def StopSearch(self):
        print(f"{self._timer_limit} seconds without improvement in objective. ")
        super().StopSearch()


@runtime
def create_var(model, df, map_idx, num_cnts, sbc):
    """Create the relevant variables"""
    num_players, num_teamIds, num_leagueId, num_nationId, num_ratingTier = (
        num_cnts[0],
        num_cnts[1],
        num_cnts[2],
        num_cnts[3],
        num_cnts[4],
    )

    player = []  # player[i] = 1 => i^th player is considered and 0 otherwise
    chem = []  # chem[i] = chemistry of i^th player

    # Preprocessing things to speed-up model creation time.
    # Thanks Gregory Wullimann !!
    players_grouped = {
        "teamId": {},
        "leagueId": {},
        "nationId": {},
        "possiblePositions": {},
        "rating": {},
        "ratingTier": {},
        "groups": {},
        "rarityId": {},
        "name": {},
    }
    # Try adding hints to solver to enable rerun of solver multiple times and start where you left off
    playerHintsAsset = set()
    playerHintsDefinition = set()
    current_solution = [
        value for value in (sbc.get("currentSolution") or []) if value not in (None, "", 0)
    ]
    formation = sbc.get("formation") or []

    hinted_assets_from_solution = {}
    hinted_definitions_from_solution = {}
    asset_ids = set(pd.to_numeric(df.get("assetId", []), errors="coerce").dropna().astype(int)) if "assetId" in df.columns else set()
    definition_ids = set(pd.to_numeric(df.get("definitionId", []), errors="coerce").dropna().astype(int)) if "definitionId" in df.columns else set()

    for idx, raw_value in enumerate(current_solution):
        try:
            normalized_value = int(raw_value)
        except Exception:
            continue

        solution_position = formation[idx] if idx < len(formation) else None
        if normalized_value in asset_ids:
            hinted_assets_from_solution.setdefault(normalized_value, solution_position)
        if normalized_value in definition_ids:
            hinted_definitions_from_solution.setdefault(normalized_value, solution_position)

    force_hint_col = "__currentSolutionHint"
    force_hint_present = force_hint_col in df.columns
    hinted_rows = 0
    for i in range(num_players):
        boolVar = model.NewBoolVar(f"player{i}")
        player.append(boolVar)

        has_current_solution = bool(hinted_assets_from_solution or hinted_definitions_from_solution)
        player_asset_id = df.at[i, "assetId"] if "assetId" in df.columns else None
        player_definition_id = (
            df.at[i, "definitionId"] if "definitionId" in df.columns else None
        )
        player_position = df.at[i, "possiblePositions"]

        hinted_solution_position = None
        if player_asset_id in hinted_assets_from_solution:
            hinted_solution_position = hinted_assets_from_solution[player_asset_id]
        elif player_definition_id in hinted_definitions_from_solution:
            hinted_solution_position = hinted_definitions_from_solution[player_definition_id]

        is_force_hinted = False
        if force_hint_present:
            try:
                is_force_hinted = bool(df.at[i, force_hint_col])
            except Exception:
                is_force_hinted = False

        # Check if player's position is compatible with the hinted solution position
        # More flexible check: if hinted position is in player's possible positions
        position_compatible = True
        if hinted_solution_position is not None:
            if isinstance(player_position, list):
                position_compatible = hinted_solution_position in player_position
            else:
                position_compatible = player_position == hinted_solution_position

        should_hint_on = False
        if (
            player_asset_id in hinted_assets_from_solution
            and player_asset_id not in playerHintsAsset
            and position_compatible
        ):
            should_hint_on = True
            playerHintsAsset.add(player_asset_id)
        elif (
            player_definition_id in hinted_definitions_from_solution
            and player_definition_id not in playerHintsDefinition
            and position_compatible
        ):
            should_hint_on = True
            playerHintsDefinition.add(player_definition_id)
        elif (
            is_force_hinted
            and player_asset_id not in playerHintsAsset
            and player_definition_id not in playerHintsDefinition
        ):
            should_hint_on = True
            if player_asset_id is not None:
                playerHintsAsset.add(player_asset_id)
            if player_definition_id is not None:
                playerHintsDefinition.add(player_definition_id)

        # If currentSolution exists, only hint matching players to avoid infeasible
        # complete hints; otherwise provide a full 0/1 hint set.
        if has_current_solution:
            if should_hint_on:
                model.AddHint(boolVar, 1)
                hinted_rows += 1
        else:
            # Provide complete hints: hint matching players to 1, non-matching to 0
            if should_hint_on:
                model.AddHint(boolVar, 1)
                hinted_rows += 1
            else:
                model.AddHint(boolVar, 0)
                hinted_rows += 1

        chem.append(model.NewIntVar(0, 3, f"chem{i}"))
        players_grouped["teamId"][map_idx["teamId"][df.at[i, "teamId"]]] = (
            players_grouped["teamId"].get(map_idx["teamId"][df.at[i, "teamId"]], [])
            + [player[i]]
        )
        players_grouped["leagueId"][map_idx["leagueId"][df.at[i, "leagueId"]]] = (
            players_grouped["leagueId"].get(
                map_idx["leagueId"][df.at[i, "leagueId"]], []
            )
            + [player[i]]
        )
        players_grouped["nationId"][map_idx["nationId"][df.at[i, "nationId"]]] = (
            players_grouped["nationId"].get(
                map_idx["nationId"][df.at[i, "nationId"]], []
            )
            + [player[i]]
        )
        players_grouped["possiblePositions"][
            map_idx["possiblePositions"][df.at[i, "possiblePositions"]]
        ] = players_grouped["possiblePositions"].get(
            map_idx["possiblePositions"][df.at[i, "possiblePositions"]], []
        ) + [player[i]]
        players_grouped["rating"][map_idx["rating"][df.at[i, "rating"]]] = (
            players_grouped["rating"].get(map_idx["rating"][df.at[i, "rating"]], [])
            + [player[i]]
        )
        players_grouped["ratingTier"][map_idx["ratingTier"][df.at[i, "ratingTier"]]] = (
            players_grouped["ratingTier"].get(
                map_idx["ratingTier"][df.at[i, "ratingTier"]], []
            )
            + [player[i]]
        )
        players_grouped["groups"][map_idx["groups"][df.at[i, "groups"]]] = (
            players_grouped["groups"].get(map_idx["groups"][df.at[i, "groups"]], [])
            + [player[i]]
        )
        players_grouped["rarityId"][map_idx["rarityId"][df.at[i, "rarityId"]]] = (
            players_grouped["rarityId"].get(
                map_idx["rarityId"][df.at[i, "rarityId"]], []
            )
            + [player[i]]
        )
        players_grouped["name"][map_idx["name"][df.at[i, "name"]]] = players_grouped[
            "name"
        ].get(map_idx["name"][df.at[i, "name"]], []) + [player[i]]

    if hinted_rows > 0:
        add_log(f"Applied current-solution hints to {hinted_rows} player rows")

    # These variables are basically chemistry of each teamId, leagueId and nation
    z_teamId = [model.NewIntVar(0, 3, f"z_teamId{i}") for i in range(num_teamIds)]
    z_leagueId = [model.NewIntVar(0, 3, f"z_leagueId{i}") for i in range(num_leagueId)]
    z_nation = [model.NewIntVar(0, 3, f"z_nation{i}") for i in range(num_nationId)]

    # Needed for chemistry constraint
    b_c = [
        [model.NewBoolVar(f"b_c{j}{i}") for i in range(4)] for j in range(num_teamIds)
    ]
    b_l = [
        [model.NewBoolVar(f"b_l{j}{i}") for i in range(4)] for j in range(num_leagueId)
    ]
    b_n = [
        [model.NewBoolVar(f"b_n{j}{i}") for i in range(4)] for j in range(num_nationId)
    ]

    # These variables represent whether a particular teamId, leagueId or nation is
    # considered in the final solution or not
    teamId = [model.NewBoolVar(f"teamId_{i}") for i in range(num_teamIds)]
    nationId = [model.NewBoolVar(f"nationId_{i}") for i in range(num_nationId)]
    leagueId = [model.NewBoolVar(f"leagueId_{i}") for i in range(num_leagueId)]
    return (
        model,
        player,
        chem,
        z_teamId,
        z_leagueId,
        z_nation,
        b_c,
        b_l,
        b_n,
        teamId,
        nationId,
        leagueId,
        players_grouped,
        hinted_rows,
    )


@runtime
def create_basic_constraints(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_PLAYERS
):
    """Create some essential constraints"""
    # Max players in squad
    model.Add(cp_model.LinearExpr.Sum(player) == NUM_PLAYERS)

    # Unique players constraint. Currently different players of same name not present in dataset.
    # Same player with multiple card versions present.
    for idx, expr in players_grouped["name"].items():
        model.Add(cp_model.LinearExpr.Sum(expr) <= 1)

    # Formation constraint
    # if input.PLAYERS_IN_POSITIONS == True:
    #     formation_list = input.formation_dict[input.FORMATION]
    #     cnt = {}
    #     for pos in formation_list:
    #         cnt[pos] = formation_list.count(pos)
    #     for pos, num in cnt.items():
    #         expr = players_grouped["possiblePositions"].get(
    #             map_idx["possiblePositions"][pos], [])
    #         model.Add(cp_model.LinearExpr.Sum(expr) == num)
    return model


@runtime
def create_nationId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_nationId, NATIONS, SCOPE
):
    """Create nationId constraint (>=)"""
    for i, nation_list in enumerate(NATIONS):
        expr = []
        for nation in nation_list:
            try:
                expr += players_grouped["nationId"].get(map_idx["nationId"][nation], [])
            except Exception as error:
                print("An exception occurred:", error)
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_nationId[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_nationId[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_nationId[i])
       
    return model


@runtime
def create_leagueId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_leagueId, LEAGUES, SCOPE
):
    """Create leagueId constraint (>=)"""
    for i, leagueId_list in enumerate(LEAGUES):
        expr = []
        for leagueId in leagueId_list:
            try:
                expr += players_grouped["leagueId"].get(
                    map_idx["leagueId"][leagueId], []
                )
            except Exception as error:
                print("An exception occurred:", error)
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_leagueId[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_leagueId[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_leagueId[i])
    return model


@runtime
def create_teamId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_teamId, TEAMS, SCOPE
):
    """Create teamId constraint (>=)"""
    for i, teamId_list in enumerate(TEAMS):
        expr = []
        for teamId in teamId_list:
            try:
                expr += players_grouped["teamId"].get(map_idx["teamId"][teamId], [])
            except Exception as error:
                print("An exception occurred:", error)
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_teamId[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_teamId[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_teamId[i])
    return model


@runtime
def create_rarity_group_constraint(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    NUM_RARITY_GROUP,
    RARITY_GROUPS,
):
    """Create rarity group constraint (>=)"""
    for i, groupId_list in enumerate(RARITY_GROUPS):
        expr = []
        for groupId in groupId_list:
            try:
                expr += players_grouped["groups"].get(map_idx["groups"][groupId], [])
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_RARITY_GROUP[i])
    return model


@runtime
def create_exact_rarity_group_constraint(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    NUM_RARITY_GROUP,
    RARITY_GROUPS,
):
    """Create rarity group constraint (>=)"""
    for i, groupId_list in enumerate(RARITY_GROUPS):
        expr = []
        for groupId in groupId_list:
            try:
                expr += players_grouped["groups"].get(map_idx["groups"][groupId], [])
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) == NUM_RARITY_GROUP[i])
    return model


@runtime
def create_rarity_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_RARITY, RARITIES
):
    """Create rarity constraint (>=)"""

    for i, groupId_list in enumerate(RARITIES):
        expr = []
        for groupId in groupId_list:
            try:
                expr += players_grouped["rarityId"].get(
                    map_idx["rarityId"][groupId], []
                )
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_RARITY[i])

    return model


@runtime
def create_player_level_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_LEVEL, LEVELS
):
    """Create rarity constraint (>=)"""

    for i, groupId_list in enumerate(LEVELS):
        expr = []
        for groupId in groupId_list:
            try:
                expr += players_grouped["ratingTier"].get(
                    map_idx["ratingTier"][groupId], []
                )
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_LEVEL[i])

    return model


excess = []
R = {}
rat_expr = []


@runtime
def create_squad_rating_constraint_3(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    num_players,
    squad_rating,
    scope,
):
    """Squad rating: Min/Max XX using the exact EA squad-rating formula.

    EA rating = floor((S + E) / 11) where
        S = sum of the 11 selected ratings
        E = sum_i max(0, rating_i - S/11)   (per-player excess above the mean)

    The previous implementation scaled everything by precision=10000 to model
    the /11 average, which blew every variable domain up to ~10^6 and produced
    multiplication products near 10^10 -- very slow for CP-SAT.

    Multiplying through by 11 removes the fractional average entirely and keeps
    every domain in the low thousands:

        11 * E  = sum_r R_r * max(0, 11*r - S)
        11*(S + E) = 11*S + 11*E   ->   final

    where R_r is the number of selected players at rating r.

    Rating-band pruning
    -------------------
    The excess term is the expensive part (a variable*variable product per
    rating).  Bounding the raw sum S near the target squeezes every excess/R
    domain, so presolve fixes most of them and the search collapses.  This is
    why removing the band made high-rated squads slow.

    The band pins the raw average to  target +/- band_points  and is applied
    only for high targets, where the achievable excess boost is small so the
    band cannot cut the optimum.  For low targets the excess boost can be large
    (a few high cards carrying many low ones), so the band is skipped to stay
    correct -- those solves are already fast because the pool is unconstrained.

    Tunables (env):
      AUTO_SBC_RATING_BAND            band half-width in rating points (default 1)
      AUTO_SBC_RATING_BAND_THRESHOLD  only band when target > this (default 84)
    """
    target = int(round(squad_rating))
    max_rating = 99
    band_points = int(os.getenv("AUTO_SBC_RATING_BAND", "1"))
    band_threshold = int(os.getenv("AUTO_SBC_RATING_BAND_THRESHOLD", "82"))

    # S = sum of selected ratings (no scaling).
    total_var = model.NewIntVar(0, max_rating * num_players, "total_rating")
    model.AddHint(total_var, 0)
    model.Add(
        total_var
        == cp_model.LinearExpr.WeightedSum(
            player, df["rating"].astype(int).tolist()
        )
    )

    # 11 * E, accumulated only over rating groups that actually have players.
    excess = []
    for rating in df["rating"].unique().tolist():
        rating_idx = map_idx["rating"][rating]
        expr = players_grouped["rating"].get(rating_idx, [])
        if not expr:
            continue

        r11 = int(round(rating * 11))

        # R_r = count of selected players at this rating (<= squad size).
        R = model.NewIntVar(0, num_players, f"R{rating_idx}")
        model.AddHint(R, 0)
        model.Add(R == cp_model.LinearExpr.Sum(expr))

        # excess_r = max(0, 11*r - S)  -- integer, small domain.
        excess_var = model.NewIntVar(0, max_rating * 11, f"excess_{rating}")
        model.AddHint(excess_var, 0)
        model.AddMaxEquality(excess_var, [r11 - total_var, 0])

        # tre_r = R_r * excess_r  (small * small -> fast multiplication).
        total_rating_excess = model.NewIntVar(
            0, num_players * max_rating * 11, f"tre{rating}"
        )
        model.AddHint(total_rating_excess, 0)
        model.AddMultiplicationEquality(total_rating_excess, [R, excess_var])
        excess.append(total_rating_excess)

    sum_excess = cp_model.LinearExpr.Sum(excess)  # == 11 * E
    final_rating = 11 * total_var + sum_excess     # == 11 * (S + E)

    # squad = floor((S + E) / 11) >= target  <=>  11*(S + E) >= 121*target - 5
    # (the -5/-6 reproduces the previous half-point rounding tolerance).
    if scope == "LOWER":
        model.Add(final_rating <= 121 * target - 6)
    else:
        model.Add(final_rating >= 121 * target - 5)

        # Rating-band prune: pin the raw sum S near the target so the excess
        # domains collapse.  Only for high targets, where it cannot cut the
        # optimum.  This is what keeps min-rating solves fast.
        if band_points > 0 and target > band_threshold:
            model.Add(total_var >= (target - band_points) * num_players)
            model.Add(total_var <= (target + band_points) * num_players)
            add_log(
                f"Applied rating band S in "
                f"[{(target - band_points) * num_players}, "
                f"{(target + band_points) * num_players}] "
                f"(target {target}, band +/-{band_points})"
            )
    return model, final_rating, total_var, sum_excess


@runtime
def create_squad_rating_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, num_players, squad_rating
):
    """Squad rating: Min XX (>=)"""
    ratings = df["rating"].tolist()
    df["avgratings"] = df["rating"] / num_players

    total_rating_expr = cp_model.LinearExpr.WeightedSum(player, ratings)

    average_rating = cp_model.LinearExpr.WeightedSum(player, df["avgratings"].tolist())
    # excess  (each player's rating - total avg rating)

    excess = [model.NewIntVar(0, 99, f"excess{i}") for i in range(len(ratings))]
    for var in excess:
        model.AddHint(var, 0)
    [
        model.AddMaxEquality(
            excess[i], [(player[i] * (ratings[i] - average_rating)), 0]
        )
        for i in range(len(player))
    ]

    sum_excess = cp_model.LinearExpr.WeightedSum(player, excess)
    total_squad_rating = total_rating_expr + sum_excess
    model.Add(total_squad_rating >= squad_rating * num_players)
    return model, total_rating_expr, sum_excess


@runtime
def create_min_overall_constraint(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    NUM_MIN_OVERALL,
    MIN_OVERALL,
    SCOPE,
):
    """
    Minimum OVR constraint.
    MIN_OVERALL[i] with SCOPE applies to the count of players whose rating >= MIN_OVERALL[i].

    SCOPE semantics:
      GREATER / GREATER_OR_EQUAL : Sum >= NUM_MIN_OVERALL[i]
      LOWER / LESS               : Sum <= NUM_MIN_OVERALL[i]
      EXACT                      : Sum == NUM_MIN_OVERALL[i]
    """
    ratings = df["rating"].dropna()
    if ratings.empty:
        return model

    max_rating = int(ratings.max())
    for i, threshold in enumerate(MIN_OVERALL):
        expr = []
        for rat in range(threshold, max_rating + 1):
            if rat not in map_idx["rating"]:
                continue
            expr.extend(players_grouped["rating"].get(map_idx["rating"][rat], []))
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_MIN_OVERALL[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_MIN_OVERALL[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_MIN_OVERALL[i])
        else:
            raise ValueError(
                f"Unsupported SCOPE '{SCOPE}' for create_min_overall_constraint"
            )
    return model


@runtime
def create_max_overall_constraint(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    NUM_MAX_OVERALL,
    MAX_OVERALL,
    SCOPE,
):
    for i, threshold in enumerate(MAX_OVERALL):
        expr = []
        # Collect players with rating <= threshold
        for rat in map_idx["rating"].keys():
            if rat <= threshold:
                expr.extend(players_grouped["rating"].get(map_idx["rating"][rat], []))
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_MAX_OVERALL[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_MAX_OVERALL[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_MAX_OVERALL[i])
        else:
            raise ValueError(
                f"Unsupported SCOPE '{SCOPE}' for create_max_overall_constraint"
            )
    return model


@runtime
def create_player_exact_overall_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_MAX_OVERALL, MAX_OVERALL
):
    """Exact Max OVR of XX"""

    for i, rating in enumerate(MAX_OVERALL):
        model.Add(
            cp_model.LinearExpr.Sum(
                players_grouped["rating"].get(map_idx["rating"][rating], [])
            )
            == NUM_MAX_OVERALL[i]
        )
    return model


@runtime
def create_chemistry_constraint(
    df,
    model,
    chem,
    z_teamId,
    z_leagueId,
    z_nation,
    player,
    players_grouped,
    num_cnts,
    map_idx,
    b_c,
    b_l,
    b_n,
    formation,
    CHEMISTRY,
    CHEM_PER_PLAYER,
    NUM_PLAYERS,
):
    """Formation-level chemistry constraint.

    After possiblePositions explode in setup.py, each row is a single
    player x position pair.  player[i]=1 already means "this player fills
    this formation slot", so no separate pos[] variables are needed.

    Algorithm:
    1. Partition rows into in-formation vs out-of-formation (static).
    2. Formation slot limits: sum(player[i]) per position <= slot count.
    3. Group tier variables: weighted sum of player[i] -> bucket -> tier
       (only for groups with in-formation rows).
    4. Per in-formation player: chem[i] = min(club_tier + league_tier +
       nation_tier, 3) when selected, 0 otherwise.  maxChem players
       always get 3 when selected.
    5. sum(chem) >= CHEMISTRY.
    """
    add_log(
        f"Creating chemistry constraint with target: {CHEMISTRY}, "
        f"min per player: {CHEM_PER_PLAYER}"
    )

    num_players = num_cnts[0]
    formation_set = set(formation)
    position_counts = {}
    for p in formation:
        position_counts[p] = position_counts.get(p, 0) + 1

    add_log(f"Formation: {formation}")
    add_log(f"Positions in formation: {position_counts}")

    # --- Pre-read columns as arrays (avoids repeated .at[] lookups) ---
    pos_col = df["possiblePositions"].values
    league_col = df["leagueId"].values
    nation_col = df["nationId"].values
    club_col = (
        df["normalizeClubId"].fillna(df["teamId"]).values
        if "normalizeClubId" in df.columns
        else df["teamId"].values
    )
    maxchem_col = (
        df["maxChem"].values if "maxChem" in df.columns else [False] * num_players
    )
    tc_col = (
        df["teamChem.contribution"].fillna(1).astype(int).values
        if "teamChem.contribution" in df.columns
        else [1] * num_players
    )
    lc_col = (
        df["leagueChem.contribution"].fillna(1).astype(int).values
        if "leagueChem.contribution" in df.columns
        else [1] * num_players
    )
    nc_col = (
        df["nationChem.contribution"].fillna(1).astype(int).values
        if "nationChem.contribution" in df.columns
        else [1] * num_players
    )

    # --- Partition rows ---
    by_slot = {}          # position -> [row indices]
    club_grp = {}         # club_id  -> [(player_var, weight)]
    league_grp = {}       # league_id -> [(player_var, weight)]
    nation_grp = {}       # nation_id -> [(player_var, weight)]
    in_pos_rows = []      # (index, club, league, nation, maxChem)

    for i in range(num_players):
        p = pos_col[i]
        if p not in formation_set:
            model.Add(chem[i] == 0)
            continue

        c, l, n = club_col[i], league_col[i], nation_col[i]
        in_pos_rows.append((i, c, l, n, bool(maxchem_col[i])))
        by_slot.setdefault(p, []).append(i)

        tc, lc, nc = int(tc_col[i]), int(lc_col[i]), int(nc_col[i])
        if tc > 0:
            club_grp.setdefault(c, []).append((player[i], tc))
        if lc > 0:
            league_grp.setdefault(l, []).append((player[i], lc))
        if nc > 0:
            nation_grp.setdefault(n, []).append((player[i], nc))

    add_log(
        f"In-formation rows: {len(in_pos_rows)}, "
        f"out-of-formation: {num_players - len(in_pos_rows)}"
    )

    # --- Formation slot limits ---
    for p, indices in by_slot.items():
        model.Add(
            cp_model.LinearExpr.Sum([player[i] for i in indices])
            <= position_counts[p]
        )

    # --- Tier variables (only for populated groups) ---
    buckets = {
        "club":   [[0, 1], [2, 3], [4, 6], [7, NUM_PLAYERS]],
        "league": [[0, 2], [3, 4], [5, 7], [8, NUM_PLAYERS]],
        "nation": [[0, 1], [2, 4], [5, 7], [8, NUM_PLAYERS]],
    }

    def _build_tiers(grp, bkts, tag):
        tiers = {}
        for gid, members in grp.items():
            z = model.NewIntVar(0, 3, f"z_{tag}_{gid}")
            tiers[gid] = z
            if all(w == 1 for _, w in members):
                total = cp_model.LinearExpr.Sum([v for v, _ in members])
            else:
                total = cp_model.LinearExpr.WeightedSum(
                    [v for v, _ in members], [w for _, w in members]
                )
            bs = [model.NewBoolVar(f"b_{tag}_{gid}_{k}") for k in range(4)]
            for k, (lo, hi) in enumerate(bkts):
                model.AddLinearConstraint(total, lo, hi).OnlyEnforceIf(bs[k])
                model.Add(z == k).OnlyEnforceIf(bs[k])
            model.AddExactlyOne(bs)
        return tiers

    ct = _build_tiers(club_grp, buckets["club"], "c")
    lt = _build_tiers(league_grp, buckets["league"], "l")
    nt = _build_tiers(nation_grp, buckets["nation"], "n")

    add_log(
        f"Chemistry groups: {len(ct)} clubs, {len(lt)} leagues, {len(nt)} nations"
    )

    # --- Per-player chemistry (in-formation rows only) ---
    for i, c, l, n, is_max in in_pos_rows:
        if is_max:
            model.Add(chem[i] == 3).OnlyEnforceIf(player[i])
            model.Add(chem[i] == 0).OnlyEnforceIf(player[i].Not())
        else:
            parts = []
            if c in ct:
                parts.append(ct[c])
            if l in lt:
                parts.append(lt[l])
            if n in nt:
                parts.append(nt[n])

            if not parts:
                model.Add(chem[i] == 0)
            else:
                s = cp_model.LinearExpr.Sum(parts)
                b = model.NewBoolVar(f"cap_{i}")
                model.Add(s <= 3).OnlyEnforceIf([b, player[i]])
                model.Add(s > 3).OnlyEnforceIf([b.Not(), player[i]])
                model.Add(chem[i] == s).OnlyEnforceIf([b, player[i]])
                model.Add(chem[i] == 3).OnlyEnforceIf([b.Not(), player[i]])
                model.Add(chem[i] == 0).OnlyEnforceIf(player[i].Not())

    # --- Total chemistry ---
    if CHEMISTRY > 0:
        model.Add(cp_model.LinearExpr.Sum(chem) >= CHEMISTRY)
        add_log(f"Added constraint for total chemistry >= {CHEMISTRY}")

    # --- Per-player minimum chemistry ---
    if CHEM_PER_PLAYER > 0:
        for i in range(num_players):
            model.Add(chem[i] >= CHEM_PER_PLAYER).OnlyEnforceIf(player[i])
        add_log(f"Each selected player must have chemistry >= {CHEM_PER_PLAYER}")

    return model, None, chem


@runtime
def create_max_teamId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MAX_NUM_teamId
):
    """Same teamId Count: Max X / Max X Players from the Same teamId (<=)"""
    num_teamIds = num_cnts[1]
    for i in range(num_teamIds):
        expr = players_grouped["teamId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) <= MAX_NUM_teamId)
    return model


@runtime
def create_max_leagueId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MAX_NUM_leagueId
):
    """Same leagueId Count: Max X / Max X Players from the Same leagueId (<=)"""
    num_leagueId = num_cnts[2]
    for i in range(num_leagueId):
        expr = players_grouped["leagueId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) <= MAX_NUM_leagueId)
    return model


@runtime
def create_max_nationId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MAX_NUM_nationId
):
    """Same Nation Count: Max X / Max X Players from the Same Nation (<=)"""
    num_nationId = num_cnts[3]
    for i in range(num_nationId):
        expr = players_grouped["nationId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) <= MAX_NUM_nationId)
    return model


@runtime
def create_min_teamId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MIN_NUM_teamId
):
    """Same teamId Count: Min X / Min X Players from the Same teamId (>=)"""
    num_teamIds = num_cnts[1]
    B_C = [model.NewBoolVar(f"B_C{i}") for i in range(num_teamIds)]
    for var in B_C:
        model.AddHint(var, 0)
    for i in range(num_teamIds):
        expr = players_grouped["teamId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= MIN_NUM_teamId).OnlyEnforceIf(B_C[i])
        model.Add(cp_model.LinearExpr.Sum(expr) < MIN_NUM_teamId).OnlyEnforceIf(
            B_C[i].Not()
        )
    model.AddAtLeastOne(B_C)
    return model


@runtime
def create_min_leagueId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MIN_NUM_leagueId
):
    """Same leagueId Count: Min X / Min X Players from the Same leagueId (>=)"""
    num_leagueId = num_cnts[2]
    B_L = [model.NewBoolVar(f"B_L{i}") for i in range(num_leagueId)]
    for var in B_L:
        model.AddHint(var, 0)
    for i in range(num_leagueId):
        expr = players_grouped["leagueId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= MIN_NUM_leagueId).OnlyEnforceIf(
            B_L[i]
        )
        model.Add(cp_model.LinearExpr.Sum(expr) < MIN_NUM_leagueId).OnlyEnforceIf(
            B_L[i].Not()
        )
    model.AddAtLeastOne(B_L)
    return model


@runtime
def create_min_nationId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MIN_NUM_nationId
):
    """Same Nation Count: Min X / Min X Players from the Same Nation (>=)"""
    num_nationId = num_cnts[3]
    B_N = [model.NewBoolVar(f"B_N{i}") for i in range(num_nationId)]
    for var in B_N:
        model.AddHint(var, 0)
    for i in range(num_nationId):
        expr = players_grouped["nationId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= MIN_NUM_nationId).OnlyEnforceIf(
            B_N[i]
        )
        model.Add(cp_model.LinearExpr.Sum(expr) < MIN_NUM_nationId).OnlyEnforceIf(
            B_N[i].Not()
        )
    model.AddAtLeastOne(B_N)
    return model


@runtime
def create_unique_teamId_constraint(
    df, model, player, teamId, map_idx, players_grouped, num_cnts, NUM_UNIQUE_teamId
):
    """teamIds: Max / Min / Exactly X"""
    num_teamIds = num_cnts[1]
    for i in range(num_teamIds):
        expr = players_grouped["teamId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= 1).OnlyEnforceIf(teamId[i])
        model.Add(cp_model.LinearExpr.Sum(expr) == 0).OnlyEnforceIf(teamId[i].Not())
    if NUM_UNIQUE_teamId[1] == "GREATER":
        model.Add(cp_model.LinearExpr.Sum(teamId) >= NUM_UNIQUE_teamId[0])
    elif NUM_UNIQUE_teamId[1] == "LOWER":
        model.Add(cp_model.LinearExpr.Sum(teamId) <= NUM_UNIQUE_teamId[0])
    elif NUM_UNIQUE_teamId[1] == "EXACT":
        model.Add(cp_model.LinearExpr.Sum(teamId) == NUM_UNIQUE_teamId[0])
    else:
        print("**Couldn't create unique_teamId_constraint!**")
    return model


@runtime
def create_unique_leagueId_constraint(
    df, model, player, leagueId, map_idx, players_grouped, num_cnts, NUM_UNIQUE_leagueId
):
    """leagueIds: Max / Min / Exactly X"""
    num_leagueId = num_cnts[2]

    for i in range(num_leagueId):
        expr = players_grouped["leagueId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= 1).OnlyEnforceIf(leagueId[i])
        model.Add(cp_model.LinearExpr.Sum(expr) == 0).OnlyEnforceIf(leagueId[i].Not())
    if NUM_UNIQUE_leagueId[1] == "GREATER":
        model.Add(cp_model.LinearExpr.Sum(leagueId) >= NUM_UNIQUE_leagueId[0])
    elif NUM_UNIQUE_leagueId[1] == "LOWER":
        model.Add(cp_model.LinearExpr.Sum(leagueId) <= NUM_UNIQUE_leagueId[0])
    elif NUM_UNIQUE_leagueId[1] == "EXACT":
        model.Add(cp_model.LinearExpr.Sum(leagueId) == NUM_UNIQUE_leagueId[0])
    else:
        print("**Couldn't create unique_leagueId_constraint!**")
    return model


@runtime
def create_unique_nationId_constraint(
    df, model, player, nationId, map_idx, players_grouped, num_cnts, NUM_UNIQUE_nationId
):
    """Nations: Max / Min / Exactly X"""
    num_nationId = num_cnts[3]
    for i in range(num_nationId):
        expr = players_grouped["nationId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= 1).OnlyEnforceIf(nationId[i])
        model.Add(cp_model.LinearExpr.Sum(expr) == 0).OnlyEnforceIf(nationId[i].Not())
    if NUM_UNIQUE_nationId[1] == "GREATER":
        model.Add(cp_model.LinearExpr.Sum(nationId) >= NUM_UNIQUE_nationId[0])
    elif NUM_UNIQUE_nationId[1] == "LOWER":
        model.Add(cp_model.LinearExpr.Sum(nationId) <= NUM_UNIQUE_nationId[0])
    elif NUM_UNIQUE_nationId[1] == "EXACT":
        model.Add(cp_model.LinearExpr.Sum(nationId) == NUM_UNIQUE_nationId[0])
    else:
        print("**Couldn't create unique_nationId_constraint!**")
    return model


MINIMIZE_MAX_COST = False
MAXIMIZE_TOTAL_COST = False


@runtime
def set_objective(df, model, player):
    """Set objective based on player cost.
    The default behaviour of the solver is to minimize the overall cost.
    """
    cost = df["price"].tolist()
    if MINIMIZE_MAX_COST:
        print("**MINIMIZE_MAX_COST**")
        max_cost = model.NewIntVar(0, df["price"].max(), "max_cost")
        model.AddHint(max_cost, 0)
        play_cost = [player[i] * cost[i] for i in range(len(cost))]
        model.AddMaxEquality(max_cost, play_cost)
        model.Minimize(max_cost)
    elif MAXIMIZE_TOTAL_COST:
        print("**MAXIMIZE_TOTAL_COST**")
        model.Maximize(cp_model.LinearExpr.WeightedSum(player, cost))
    else:
        print("**MINIMIZE_TOTAL_COST**")
        model.Minimize(cp_model.LinearExpr.WeightedSum(player, cost))
    return model


def get_dict(df, col):
    """Map fields to a unique index"""
    d = {}
    unique_col = df[col].unique()
    for i, val in enumerate(unique_col):
        d[val] = i
    return d


@runtime
def add_comprehensive_hints(
    model,
    player,
    chem,
    z_teamId,
    z_leagueId,
    z_nation,
    b_c,
    b_l,
    b_n,
    teamId,
    nationId,
    leagueId,
    df,
    num_cnts,
):
    """
    Add comprehensive warm-start hints for ALL decision variables.
    This maximizes hint coverage to improve solver performance.
    Note: Player selection hints are already handled in create_var() based on currentSolution.
    """
    hint_count = 0
    num_players = num_cnts[0]
    num_teamIds = num_cnts[1]
    num_leagueId = num_cnts[2]
    num_nationId = num_cnts[3]

    # Skip player selection hints - already handled in create_var() from currentSolution
    # This avoids overwriting the current solution hints with generic fallback hints

    # Hint chemistry variables (default to 0, will be updated by solver)
    for i in range(num_players):
        try:
            model.AddHint(chem[i], 0)
            hint_count += 1
        except Exception:
            pass

    # Hint team chemistry tier variables (default to 0)
    for j in range(num_teamIds):
        try:
            model.AddHint(z_teamId[j], 0)
            hint_count += 1
        except Exception:
            pass

    # Hint league chemistry tier variables (default to 0)
    for j in range(num_leagueId):
        try:
            model.AddHint(z_leagueId[j], 0)
            hint_count += 1
        except Exception:
            pass

    # Hint nation chemistry tier variables (default to 0)
    for j in range(num_nationId):
        try:
            model.AddHint(z_nation[j], 0)
            hint_count += 1
        except Exception:
            pass

    # Hint chemistry tier selection booleans for teams (all false initially)
    for j in range(num_teamIds):
        try:
            for idx in range(4):
                model.AddHint(b_c[j][idx], 0 if idx > 0 else 1)
                hint_count += 1
        except Exception:
            pass

    # Hint chemistry tier selection booleans for leagues (all false initially)
    for j in range(num_leagueId):
        try:
            for idx in range(4):
                model.AddHint(b_l[j][idx], 0 if idx > 0 else 1)
                hint_count += 1
        except Exception:
            pass

    # Hint chemistry tier selection booleans for nations (all false initially)
    for j in range(num_nationId):
        try:
            for idx in range(4):
                model.AddHint(b_n[j][idx], 0 if idx > 0 else 1)
                hint_count += 1
        except Exception:
            pass

    # Hint unique count variables (default to 0/False)
    for i in range(num_teamIds):
        try:
            model.AddHint(teamId[i], 0)
            hint_count += 1
        except Exception:
            pass

    for i in range(num_leagueId):
        try:
            model.AddHint(leagueId[i], 0)
            hint_count += 1
        except Exception:
            pass

    for i in range(num_nationId):
        try:
            model.AddHint(nationId[i], 0)
            hint_count += 1
        except Exception:
            pass

    if hint_count > 0:
        add_log(f"Added {hint_count} auxiliary variable hints (chemistry tiers, position vars, unique counts)")
    
    return model


@runtime
def SBC(df, sbc, maxSolveTime):
    """Optimize SBC using Constraint Integer Programming"""
    # Add global reference
    global solver_logs
    solver_logs = []  # Clear previous logs

    # Log start of solving
    solver_logs.append({"time": time.time(), "message": "Starting SBC solver"})

    num_cnts = [
        df.shape[0],
        df.teamId.nunique(),
        df.leagueId.nunique(),
        df.nationId.nunique(),
        df.ratingTier.nunique(),
    ]  # Count of important fields
    map_idx = {}  # Map fields to a unique index
    fields = [
        "teamId",
        "leagueId",
        "nationId",
        "possiblePositions",
        "rating",
        "ratingTier",
        "groups",
        "rarityId",
        "name",
    ]
    for field in fields:
        map_idx[field] = get_dict(df, field)

    """Create the CP-SAT Model"""
    model = cp_model.CpModel()

    """Create essential variables and do some pre-processing"""

    (
        model,
        player,
        chem,
        z_teamId,
        z_leagueId,
        z_nation,
        b_c,
        b_l,
        b_n,
        teamId,
        nationId,
        leagueId,
        players_grouped,
        hinted_rows,
    ) = create_var(model, df, map_idx, num_cnts, sbc)

    """Essential constraints"""
    NUM_PLAYERS = 11 - len(sbc["brickIndices"])
    model = create_basic_constraints(
        df, model, player, map_idx, players_grouped, num_cnts, NUM_PLAYERS
    )  

    """Comment out the constraints not required"""
    CHEMISTRY = 0
    CHEM_PER_PLAYER = 0
   
    for req in sbc["constraints"]:
        print("Adding Constraint for ", req)
        if req["requirementKey"] == "CHEMISTRY_POINTS":
            CHEMISTRY = req["eligibilityValues"][0]
        if req["requirementKey"] == "ALL_PLAYERS_CHEMISTRY_POINTS":
            CHEM_PER_PLAYER = req["eligibilityValues"][0]

        if req["requirementKey"] == "SAME_LEAGUE_COUNT":
            if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                model = create_max_leagueId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )

            if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                model = create_min_leagueId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )

        if req["requirementKey"] == "SAME_NATION_COUNT":
            if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                model = create_max_nationId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )
            if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                model = create_min_nationId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )

        if req["requirementKey"] == "SAME_CLUB_COUNT":
            if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                model = create_max_teamId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )
            if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                model = create_min_teamId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )

        if req["requirementKey"] == "NATION_COUNT":
            model = create_unique_nationId_constraint(
                df,
                model,
                player,
                nationId,
                map_idx,
                players_grouped,
                num_cnts,
                [req["eligibilityValues"][0], req["scope"]],
            )
        if req["requirementKey"] == "LEAGUE_COUNT":
            model = create_unique_leagueId_constraint(
                df,
                model,
                player,
                leagueId,
                map_idx,
                players_grouped,
                num_cnts,
                [req["eligibilityValues"][0], req["scope"]],
            )
        if req["requirementKey"] == "CLUB_COUNT":
            model = create_unique_teamId_constraint(
                df,
                model,
                player,
                teamId,
                map_idx,
                players_grouped,
                num_cnts,
                [req["eligibilityValues"][0], req["scope"]],
            )

        if req["requirementKey"] == "CLUB_ID":
            model = create_teamId_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
                req["scope"],
            )
        if req["requirementKey"] == "LEAGUE_ID":
            model = create_leagueId_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
                req["scope"],
            )

        if req["requirementKey"] == "NATION_ID":
            model = create_nationId_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
                req["scope"],
            )

        if req["requirementKey"] == "PLAYER_RARITY_GROUP":
            if req["scope"] == "EXACT":
                model = create_exact_rarity_group_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    [req["count"]],
                    [req["eligibilityValues"]],
                )
            if req["scope"] == "GREATER":
                model = create_rarity_group_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    [req["count"]],
                    [req["eligibilityValues"]],
                )

        if req["requirementKey"] == "PLAYER_RARITY":
            model = create_rarity_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
            )
        if req["requirementKey"] == "PLAYER_MIN_OVR":
            model = create_min_overall_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"][0]],
                req["scope"],
            )
        if req["requirementKey"] == "PLAYER_MAX_OVR":
            model = create_max_overall_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"][0]],
                req["scope"],
            )
        if req["requirementKey"] == "PLAYER_EXACT_OVR":
            model = create_player_exact_overall_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"][0]],
            )
        if req["requirementKey"] == "TEAM_RATING":
            model, total_rating, average_rating, sum_excess = (
                create_squad_rating_constraint_3(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    NUM_PLAYERS,
                    req["eligibilityValues"][0],
                    req["scope"],
                )
            )

        if req["requirementKey"] == "PLAYER_LEVEL":
            model = create_player_level_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
            )

    """If there is no constraint on total chemistry, simply set CHEMISTRY = 0"""
    if CHEMISTRY + CHEM_PER_PLAYER > 0:
        model, _, chem_expr = create_chemistry_constraint(
            df,
            model,
            chem,
            z_teamId,
            z_leagueId,
            z_nation,
            player,
            players_grouped,
            num_cnts,
            map_idx,
            b_c,
            b_l,
            b_n,
            sbc["formation"],
            CHEMISTRY,
            CHEM_PER_PLAYER,
            NUM_PLAYERS,
        )

    """Fix specific players and optimize the rest"""
    # model = fix_players(df, model, player, NUM_PLAYERS)

    """Set objective based on player cost"""
    model = set_objective(df, model, player)

    """Export Model to file"""
    # model.ExportToFile('model.txt')

    """Add comprehensive hints for all variables before solving"""
    model = add_comprehensive_hints(
        model,
        player,
        chem,
        z_teamId,
        z_leagueId,
        z_nation,
        b_c,
        b_l,
        b_n,
        teamId,
        nationId,
        leagueId,
        df,
        num_cnts,
    )

    """Solve"""
    print("Solve Started")
    solver_logs.append({"time": time.time(), "message": "Solve Started"})

    solver = cp_model.CpSolver()
    include_interim_results = os.getenv("AUTO_SBC_INTERIM_INCLUDE_RESULTS", "1") == "1"
    interim_emit_interval = float(os.getenv("AUTO_SBC_INTERIM_EMIT_INTERVAL_SECONDS", "2"))
    log_search_progress = os.getenv("AUTO_SBC_LOG_SEARCH_PROGRESS", "0") == "1"
    default_workers = max(1, min(12, (os.cpu_count() or 8)))
    num_search_workers = int(os.getenv("AUTO_SBC_NUM_SEARCH_WORKERS", str(default_workers)))

    """Solver Parameters"""
    # solver.parameters.random_seed = 42
    # Whether the solver should log the search progress.
    solver.parameters.max_time_in_seconds = maxSolveTime
    solver.parameters.log_search_progress = log_search_progress
    # Specify the number of parallel workers (i.e. threads) to use during search.
    # This should usually be lower than your number of available cpus + hyperthread in your machine.
    # Setting this to 16 or 24 can help if the solver is slow in improving the bound.
    solver.parameters.num_search_workers = max(1, num_search_workers)
    # Stop the search when the gap between the best feasible objective (O) and
    # our best objective bound (B) is smaller than a limit.
    # Relative: abs(O - B) / max(1, abs(O)).
    # Note that if the gap is reached, the search status will be OPTIMAL. But
    # one can check the best objective bound to see the actual gap.
    # solver.parameters.relative_gap_limit = 0.05
    # solver.parameters.cp_model_presolve = False
    # solver.parameters.stop_after_first_solution = True
    """Solver Parameters"""
    # Ensure all variables have hints to avoid "incomplete hint" warnings.
    # Variables already hinted in create_var keep their values; any remaining
    # variables (created by constraint helpers) get a default hint of 0.
    hinted_var_indices = set(model.Proto().solution_hint.vars)
    for var_idx in range(len(model.Proto().variables)):
        if var_idx not in hinted_var_indices:
            model.Proto().solution_hint.vars.append(var_idx)
            model.Proto().solution_hint.values.append(0)

    # Create callback instance
    callback = SolutionCallback(
        timer_limit=30,
        player=player,
        player_ids=df["id"].tolist(),
        player_definition_ids=df["definitionId"].tolist(),
        df=df,
        emit_interval_seconds=interim_emit_interval,
        include_interim_results=include_interim_results,
        formation=sbc.get("formation", []),
    )
    register_active_solver(solver)
    try:
        raw_status = solver.Solve(model, callback)
    finally:
        clear_active_solver(solver)
    # OR-Tools may return a CpSolverStatus wrapper object; convert to a JSON-safe int.
    try:
        status_code = int(raw_status)
    except Exception:
        # Fallback: keep a string representation to avoid FastAPI json encoding errors.
        status_code = str(raw_status)

    print("\n")
    final_players = []

    if status_code == 2 or status_code == 4:  # Feasible or Optimal
        for req in sbc["constraints"]:
            if req["requirementKey"] == "TEAM_RATING":
                print("Total Rating: ", solver.Value(total_rating))
                print("Average Rating: ", solver.Value(average_rating))
                print("Excess: ", solver.Value(sum_excess))
        df["Chemistry"] = 0
        # Is_Pos = 1 when the player's possiblePositions is in the formation.
        # After possiblePositions explode, this is a static property of each row.
        formation_set = set(sbc.get("formation", []))
        df["Is_Pos"] = 0
        for i in range(num_cnts[0]):
            if solver.Value(player[i]) == 1 and df.loc[i, "cardType"] != "BRICK":
                final_players.append(i)
                try:
                    df.loc[i, "Chemistry"] = solver.Value(chem[i])
                    df.loc[i, "Is_Pos"] = (
                        1 if df.loc[i, "possiblePositions"] in formation_set else 0
                    )
                except:
                    pass
    status_text = status_dict.get(
        status_code,
        f"UNKNOWN: Unrecognized solver status {status_code}",
    )
    return final_players, status_text, status_code


status_dict = {
    0: "UNKNOWN: The status of the model is still unknown. A search limit has been reached before any of the statuses below could be determined.",
    1: "MODEL_INVALID: The given CpModelProto didn't pass the validation step.",
    2: "FEASIBLE: A feasible solution has been found. But the search was stopped before we could prove optimality.",
    3: "INFEASIBLE: The problem has been proven infeasible.",
    4: "OPTIMAL: An optimal feasible solution has been found.",
}

