import optimize
import os
import csv
import json
import time
import pandas as pd
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from logger import add_log


DEBUG_DUMPS_ENABLED = os.getenv("AUTO_SBC_DEBUG_DUMPS", "1") == "1"
FILTER_LOG_ENABLED = os.getenv("AUTO_SBC_FILE_LOGS", "1") == "1"
FILTER_LOG_FILE = os.path.join(os.path.dirname(__file__), "logs", "player_filter_log.csv")


def maybe_dump_csv(df: pd.DataFrame, path: str):
    if DEBUG_DUMPS_ENABLED:
        df.to_csv(path)


def _concept_count(df: pd.DataFrame) -> int:
    if "concept" not in df.columns:
        return 0

    try:
        return int(df["concept"].fillna(False).astype(bool).sum())
    except Exception:
        return int((df["concept"] == True).sum())


def _append_filter_log_row(row: list):
    if not FILTER_LOG_ENABLED:
        return

    os.makedirs(os.path.dirname(FILTER_LOG_FILE), exist_ok=True)
    needs_header = (
        not os.path.exists(FILTER_LOG_FILE)
        or os.path.getsize(FILTER_LOG_FILE) == 0
    )

    with open(FILTER_LOG_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if needs_header:
            writer.writerow(
                [
                    "time",
                    "run_id",
                    "stage",
                    "reason",
                    "before_count",
                    "after_count",
                    "removed_count",
                    "before_concepts",
                    "after_concepts",
                    "removed_concepts",
                ]
            )
        writer.writerow(row)


def log_filter_step(run_id: str, stage: str, reason: str, before_df: pd.DataFrame, after_df: pd.DataFrame):
    before_count = len(before_df)
    after_count = len(after_df)
    removed_count = before_count - after_count
    before_concepts = _concept_count(before_df)
    after_concepts = _concept_count(after_df)
    removed_concepts = before_concepts - after_concepts

    _append_filter_log_row(
        [
            time.time(),
            run_id,
            stage,
            reason,
            before_count,
            after_count,
            removed_count,
            before_concepts,
            after_concepts,
            removed_concepts,
        ]
    )

    add_log(
        "[filter] "
        f"{stage} | {reason} | before={before_count}, after={after_count}, removed={removed_count}, "
        f"concept_before={before_concepts}, concept_after={after_concepts}, concept_removed={removed_concepts}"
    )


def _constraint_condition(df: pd.DataFrame, req: dict):
    if not isinstance(df, pd.DataFrame) or df.empty:
        return pd.Series([False] * len(df), index=df.index)

    key = req.get("requirementKey")
    values = req.get("eligibilityValues", [])
    scope = req.get("scope")

    if key == "PLAYER_RARITY_GROUP":
        return df["groups"].apply(
            lambda g: any(item in values for item in (g if isinstance(g, list) else [g]))
        )
    if key == "PLAYER_QUALITY":
        if scope in ["GREATER", "EXACT"]:
            return df["ratingTier"] >= values[0]
        if scope == "LOWER":
            return df["ratingTier"] <= values[0]
        return pd.Series([True] * len(df), index=df.index)
    if key == "PLAYER_LEVEL":
        return df["ratingTier"].isin(values)
    if key == "CLUB_ID":
        return df["teamId"].isin(values)
    if key == "LEAGUE_ID":
        return df["leagueId"].isin(values)
    if key == "NATION_ID":
        return df["nationId"].isin(values)
    if key == "PLAYER_RARITY":
        return df["rarityId"].isin(values)
    if key == "PLAYER_EXACT_OVR":
        return df["rating"].isin(values)
    if key == "PLAYER_MIN_OVR" and scope in ["GREATER", "EXACT"]:
        return df["rating"] >= values[0]
    if key == "PLAYER_MAX_OVR" and scope in ["LOWER", "EXACT"]:
        return df["rating"] <= values[0]

    return pd.Series([True] * len(df), index=df.index)


def analyze_failure_reasons(sbc, before_df: pd.DataFrame, after_df: pd.DataFrame):
    constraints = sbc.get("constraints", [])
    analysis = {
        "beforePreprocessCount": len(before_df),
        "afterPreprocessCount": len(after_df),
        "beforePreprocessConceptCount": _concept_count(before_df),
        "afterPreprocessConceptCount": _concept_count(after_df),
        "failedConstraints": [],
    }

    for req in constraints:
        min_required = int(req.get("count", 0) or 0)
        if min_required <= 0:
            continue

        condition_before = _constraint_condition(before_df, req)
        condition_after = _constraint_condition(after_df, req)
        count_before = int(condition_before.sum())
        count_after = int(condition_after.sum())

        if count_after < min_required:
            analysis["failedConstraints"].append(
                {
                    "requirementKey": req.get("requirementKey"),
                    "scope": req.get("scope"),
                    "required": min_required,
                    "availableBeforePreprocess": count_before,
                    "availableAfterPreprocess": count_after,
                    "removedByPreprocess": max(0, count_before - count_after),
                    "eligibilityValues": req.get("eligibilityValues", []),
                }
            )

    analysis["failedConstraintCount"] = len(analysis["failedConstraints"])
    analysis["message"] = (
        "No failing constraints detected in pre-check. "
        "Solver may still fail due to chemistry/position combinatorics."
        if analysis["failedConstraintCount"] == 0
        else "One or more constraints cannot be satisfied by the current post-filtered pool."
    )
    return analysis


SOLVE_DIAGNOSTICS_FILE = os.path.join(
    os.path.dirname(__file__), "logs", "solve_diagnostics.json"
)


def _rating_histogram(df: pd.DataFrame) -> dict:
    """Count players per rating, split by concept vs owned."""
    if not isinstance(df, pd.DataFrame) or df.empty or "rating" not in df.columns:
        return {}

    concept_mask = (
        df["concept"].fillna(False).astype(bool)
        if "concept" in df.columns
        else pd.Series([False] * len(df), index=df.index)
    )
    hist = {}
    for rating, group in df.groupby("rating"):
        cmask = concept_mask.loc[group.index]
        hist[int(rating)] = {
            "total": int(len(group)),
            "concept": int(cmask.sum()),
            "owned": int((~cmask).sum()),
        }
    return dict(sorted(hist.items()))


def write_solve_diagnostics(
    run_id: str,
    sbc: dict,
    before_df: pd.DataFrame,
    after_df: pd.DataFrame,
    status,
    status_code,
    solution_found: bool,
    failure_analysis: dict | None = None,
):
    """Write a full, human-readable snapshot of a solve to a JSON file.

    Overwrites logs/solve_diagnostics.json every solve so the latest run can
    always be inspected to understand why a solution was / wasn't found —
    especially with "use concepts" enabled, where a solution should exist.
    """
    if not FILTER_LOG_ENABLED:
        return

    try:
        diagnostics = {
            "time": time.time(),
            "runId": run_id,
            "sbc": {
                "name": sbc.get("name"),
                "setId": sbc.get("setId"),
                "challengeId": sbc.get("challengeId"),
                "formation": sbc.get("formation"),
                "constraintCount": len(sbc.get("constraints", [])),
            },
            "solutionFound": bool(solution_found),
            "status": status,
            "statusCode": status_code,
            "pool": {
                "beforePreprocess": {
                    "total": int(len(before_df)),
                    "concept": _concept_count(before_df),
                    "owned": int(len(before_df)) - _concept_count(before_df),
                },
                "afterPreprocess": {
                    "total": int(len(after_df)),
                    "concept": _concept_count(after_df),
                    "owned": int(len(after_df)) - _concept_count(after_df),
                },
                "conceptsEnabled": _concept_count(before_df) > 0,
            },
            "ratingHistogramAfterPreprocess": _rating_histogram(after_df),
            "constraints": [
                {
                    "requirementKey": req.get("requirementKey"),
                    "scope": req.get("scope"),
                    "count": req.get("count"),
                    "eligibilityValues": req.get("eligibilityValues", []),
                }
                for req in sbc.get("constraints", [])
            ],
            "failureAnalysis": failure_analysis,
        }

        os.makedirs(os.path.dirname(SOLVE_DIAGNOSTICS_FILE), exist_ok=True)
        with open(SOLVE_DIAGNOSTICS_FILE, "w", encoding="utf-8") as f:
            json.dump(diagnostics, f, indent=2, default=str)

        add_log(
            "[diagnostics] solve snapshot written | "
            f"solution_found={solution_found}, "
            f"pool_after={len(after_df)} (concept={_concept_count(after_df)}), "
            f"failed_constraints={(failure_analysis or {}).get('failedConstraintCount', 0)}"
        )
    except Exception as exc:  # never let diagnostics break a solve
        add_log(f"[diagnostics] failed to write solve diagnostics: {exc}")


def preprocess_data(df: pd.DataFrame, sbc, run_id: str = "unknown"):
    force_col = "__currentSolutionHint"
    if force_col not in df.columns:
        df[force_col] = False
    df[force_col] = df[force_col].fillna(False).astype(bool)

    maybe_dump_csv(df, "allPlayers.csv")
    groupings = []
    # Remove concept players with missing futggPrice
    before_df = df
    df = df[(~(df["concept"] & df["futggPrice"].isna())) | df[force_col]]
    log_filter_step(run_id, "preprocess", "drop_concepts_missing_futgg_price", before_df, df)
    df["price"] = df["price"].fillna(
        15000000
    )  # set price to 15m if missing so it will only use the player if really necessary
    before_df = df
    df = df[(df["price"] <= 50000) | df[force_col]]  # remove players with price greater than 50k
    log_filter_step(run_id, "preprocess", "drop_price_over_50000", before_df, df)
    expPP = False

    expPR = False
    rarityGroups = []
    total_required = 11 - len(sbc["brickIndices"])

    # Pre-scan: detect if all players are locked to 1 or 2 leagues.
    # When true, chemistry grouping by leagueId/nationId/teamId is unhelpful
    # (all players are already in the same narrow pool) — use position-based
    # grouping instead to surface the cheapest option for every slot.
    narrow_league_chemistry = any(
        req["requirementKey"] == "LEAGUE_ID"
        and req.get("count", 0) == total_required
        and len(req.get("eligibilityValues", [])) <= 2
        for req in sbc["constraints"]
    )
    if narrow_league_chemistry:
        add_log(
            "Narrow-league chemistry detected (all players from 1-2 leagues): "
            "using position-based grouping instead of leagueId/nationId/teamId."
        )

    for req in sbc["constraints"]:
        if req["count"] == total_required:
            # Filter the players to only include those that meet this requirement
            # since we need all players to satisfy this constraint
            before_count = len(df)
            add_log(
                f"Filtering players for '{req['requirementKey']}' requirement. Current player count: {before_count}"
            )
            before_df = df
            if req["requirementKey"] == "PLAYER_RARITY_GROUP":
                # Filter players where any element in the groups array matches any eligibility value
                condition = df["groups"].apply(
                    lambda x: any(g in req["eligibilityValues"] for g in x)
                )
                df = df[condition | df[force_col]]
            elif req["requirementKey"] == "PLAYER_QUALITY":
                if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                    df = df[(df["ratingTier"] >= req["eligibilityValues"][0]) | df[force_col]]
                if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                    df = df[(df["ratingTier"] <= req["eligibilityValues"][0]) | df[force_col]]
            elif req["requirementKey"] == "PLAYER_LEVEL":
                df = df[df["ratingTier"].isin(req["eligibilityValues"]) | df[force_col]]
            elif req["requirementKey"] == "CLUB_ID":
                df = df[df["teamId"].isin(req["eligibilityValues"]) | df[force_col]]
            elif req["requirementKey"] == "LEAGUE_ID":
                if DEBUG_DUMPS_ENABLED:
                    print(
                        "Unique List Of leagues and counts before filter:",
                        df["leagueId"].value_counts(),
                    )
                df = df[df["leagueId"].isin(req["eligibilityValues"]) | df[force_col]]
            elif req["requirementKey"] == "NATION_ID":
                df = df[df["nationId"].isin(req["eligibilityValues"]) | df[force_col]]
            elif req["requirementKey"] == "PLAYER_RARITY":
                df = df[df["rarityId"].isin(req["eligibilityValues"]) | df[force_col]]
            elif req["requirementKey"] == "PLAYER_EXACT_OVR":
                df = df[df["rating"].isin(req["eligibilityValues"]) | df[force_col]]
            elif req["requirementKey"] == "PLAYER_MIN_OVR" and (
                req["scope"] == "GREATER" or req["scope"] == "EXACT"
            ):
                df = df[(df["rating"] >= req["eligibilityValues"][0]) | df[force_col]]
            elif req["requirementKey"] == "PLAYER_MAX_OVR" and (
                req["scope"] == "GREATER" or req["scope"] == "EXACT"
            ):
                df = df[(df["rating"] <= req["eligibilityValues"][0]) | df[force_col]]

            after_count = len(df)
            log_filter_step(
                run_id,
                "constraint_total_required",
                req["requirementKey"],
                before_df,
                df,
            )
            if after_count < before_count:
                add_log(
                    f"Removed {before_count - after_count} players for '{req['requirementKey']}' requirement. Players left: {after_count}"
                )

        if (
            req["requirementKey"] == "CHEMISTRY_POINTS"
            or req["requirementKey"] == "ALL_PLAYERS_CHEMISTRY_POINTS"
        ):
            if narrow_league_chemistry:
                # All players are from 1-2 leagues; leagueId/nationId/teamId
                # grouping would over-filter. Use preferred position instead so
                # we keep the single cheapest candidate for each formation slot.
                # groupings.extend(["preferredPosition"])
                groupings.extend(["leagueId", "nationId", "teamId"])
            else:
                # Add league, nation, and team to groupings
                groupings.extend(["leagueId", "nationId", "teamId"])
            expPP = True
        if req["requirementKey"] == "PLAYER_RARITY_GROUP":
            groupings.extend(["groups"])
            expPR = True
            rarityGroups = rarityGroups + req["eligibilityValues"]
        if req["requirementKey"] == "SAME_LEAGUE_COUNT":
            groupings.extend(["leagueId"])
        if req["requirementKey"] == "SAME_NATION_COUNT":
            groupings.extend(["nationId"])
        if req["requirementKey"] == "SAME_CLUB_COUNT":
            groupings.extend(["teamId"])
        if req["requirementKey"] == "NATION_COUNT":
            groupings.extend(["nationId"])
        if req["requirementKey"] == "LEAGUE_COUNT":
            groupings.extend(["leagueId"])
        if req["requirementKey"] == "CLUB_COUNT":
            groupings.extend(["teamId"])
        if req["requirementKey"] == "CLUB_ID":
            groupings.extend(["teamId"])
        if req["requirementKey"] == "LEAGUE_ID":
            groupings.extend(["leagueId"])
        if req["requirementKey"] == "NATION_ID":
            groupings.extend(["nationId"])
        if req["requirementKey"] == "PLAYER_RARITY":
            groupings.extend(["rarityId"])
        if (
            req["requirementKey"] == "PLAYER_MIN_OVR"
            or req["requirementKey"] == "PLAYER_MAX_OVR"
            or req["requirementKey"] == "TEAM_RATING"
        ):
            groupings.extend(["rating"])
        if req["requirementKey"] == "PLAYER_LEVEL":
            groupings.extend(["ratingTier"])
        if req["requirementKey"] == "PLAYER_QUALITY":
            groupings.extend(["ratingTier"])
            # Creating separate entries of a particular player for each alternate position.
    if expPP:
        df = df.assign(
            possiblePositions=[
                [x for x in l if x in sbc["formation"]] for l in df["possiblePositions"]
            ]
        )
        df["possiblePositions"] = df["possiblePositions"].apply(
            lambda y: [99] if len(y) == 0 else y
        )

        df = df.explode("possiblePositions")
        groupings.extend(["possiblePositions"])
    else:
        df = df.assign(possiblePositions=-99)
    if expPR:
        df["original_groups"] = df["groups"]
        df = df.assign(
            groups=[[x for x in l if x in rarityGroups] for l in df["groups"]]
        )

        df["groups"] = df["groups"].apply(lambda y: [99] if len(y) == 0 else y)
        df = df.explode("groups")
        groupings.extend(["groups"])
    else:
        df = df.assign(groups=0)
    # Safe dominance pruning:
    # 1) Keep only cheapest card per (signature + name) because solver already
    #    enforces at most one card per name.
    # 2) Keep only cheapest K cards per signature, where K is required squad size.
    #    This preserves objective-optimal solutions while shrinking the pool.
    groupings = list(set(groupings))
    signature_fields = [field for field in groupings if field in df.columns]
    if narrow_league_chemistry:
        position_field = (
            "possiblePositions"
            if "possiblePositions" in df.columns
            else "preferredPosition" if "preferredPosition" in df.columns else None
        )
        narrow_signature_fields = [
            field for field in [position_field, "leagueId", "rating"] if field in df.columns
        ]
        if narrow_signature_fields:
            signature_fields = narrow_signature_fields
    add_log(
        f"Detected signature fields for pruning: {', '.join(signature_fields) if signature_fields else 'none'}"
    )

    before_prune = len(df)
    limit_per_signature = 11 if narrow_league_chemistry else max(1, total_required)
    sorted_df = df.sort_values("price")
    forced_rows = sorted_df[sorted_df[force_col]]
    candidate_rows = sorted_df[~sorted_df[force_col]]

    per_name_fields = signature_fields + (["name"] if "name" in candidate_rows.columns else [])
    if per_name_fields:
        candidate_rows = candidate_rows.drop_duplicates(
            subset=per_name_fields,
            keep="first",
        )
    deduped_candidate_pool = candidate_rows.copy()

    if signature_fields:
        if narrow_league_chemistry and limit_per_signature == 1 and "name" in candidate_rows.columns:
            # Keep one cheapest row per signature while preferring unique player names
            # across signatures to avoid the same low-cost multi-position card dominating.
            chosen_chunks = []
            used_names = set()
            grouped_candidates = candidate_rows.sort_values("price").groupby(
                signature_fields,
                dropna=False,
                sort=False,
            )
            for _, group in grouped_candidates:
                group_sorted = group.sort_values("price")
                available = group_sorted[~group_sorted["name"].isin(used_names)]
                pick = available.head(1) if not available.empty else group_sorted.head(1)
                if not pick.empty:
                    used_names.update(pick["name"].dropna().astype(str).tolist())
                    chosen_chunks.append(pick)

            if chosen_chunks:
                candidate_rows = pd.concat(chosen_chunks, axis=0)
            else:
                candidate_rows = candidate_rows.head(0)

            # Also keep extra depth: up to 11 cheapest players per (leagueId, rating)
            # that are not already in the per-position shortlist.
            if all(field in deduped_candidate_pool.columns for field in ["leagueId", "rating"]):
                selected_indexes = set(candidate_rows.index.tolist())
                remaining_pool = deduped_candidate_pool[
                    ~deduped_candidate_pool.index.isin(selected_indexes)
                ]

                if "name" in deduped_candidate_pool.columns and "name" in candidate_rows.columns:
                    selected_names = set(candidate_rows["name"].dropna().astype(str).tolist())
                    remaining_pool = remaining_pool[
                        ~remaining_pool["name"].fillna("").astype(str).isin(selected_names)
                    ]

                extra_rows = (
                    remaining_pool.sort_values("price")
                    .groupby(["leagueId", "rating"], dropna=False, sort=False)
                    .head(11)
                )
                if not extra_rows.empty:
                    candidate_rows = pd.concat([candidate_rows, extra_rows], axis=0)
                    candidate_rows = candidate_rows[
                        ~candidate_rows.index.duplicated(keep="first")
                    ]
                    add_log(
                        f"Narrow-league extra depth added {len(extra_rows)} players (up to 11 per league/rating)."
                    )
        else:
            candidate_rows = (
                candidate_rows.sort_values("price")
                .groupby(signature_fields, dropna=False, sort=False)
                .head(limit_per_signature)
            )
    else:
        candidate_rows = candidate_rows.head(limit_per_signature)

    combined_df = pd.concat([candidate_rows, forced_rows], axis=0)
    df = combined_df[~combined_df.index.duplicated(keep="first")].reset_index(drop=True)

    removed = before_prune - len(df)
    log_filter_step(
        run_id,
        "preprocess",
        f"dominance_pruning_limit_per_signature_{limit_per_signature}",
        sorted_df,
        df,
    )
    add_log(
        f"Dominance pruning removed {removed} players; kept {len(df)} (limit per signature={limit_per_signature})"
    )
    maybe_dump_csv(df, "filteredPlayers.csv")
    df["Original_Idx"] = df.index
    df = df.reset_index(drop=True)

    return df


def runAutoSBC(sbc, players, maxSolveTime, debug_failure_analysis=False):
    run_id = str(int(time.time() * 1000))
    add_log("Starting SBC solver process")
    add_log(f"Filter log run id: {run_id}")
    # Log SBC configuration with dynamic key-value pairs
    add_log("Starting SBC configuration processing:")
    for key, value in sbc.items():
        if isinstance(value, (list, dict)):
            if isinstance(value, dict):
                add_log(f"  {key}: Dictionary with {len(value)} items")
                for k, v in value.items():
                    add_log(f"    - {k}: {v}")
            else:  # list
                add_log(f"  {key}: List with {len(value)} items")
                if len(value) <= 5:  # Limit output for large lists
                    for item in value:
                        add_log(f"    - {item}")
                else:
                    add_log(f"    - First 5 items: {value[:5]}")
        else:
            add_log(f"  {key}: {value}")
    print(f"Processing SBC: {sbc['name'] if 'name' in sbc else 'Unknown SBC'}")
    df = pd.json_normalize(players)
    before_preprocess_df = df.copy()
    force_col = "__currentSolutionHint"
    if force_col not in df.columns:
        df[force_col] = False

    current_solution_values = [
        value for value in (sbc.get("currentSolution") or []) if value not in (None, "", 0)
    ]
    current_solution_normalized = set()
    for value in current_solution_values:
        try:
            current_solution_normalized.add(int(value))
        except Exception:
            continue

    if current_solution_normalized:
        asset_matches = df["assetId"].isin(current_solution_normalized) if "assetId" in df.columns else False
        definition_matches = (
            df["definitionId"].isin(current_solution_normalized)
            if "definitionId" in df.columns
            else False
        )
        if isinstance(asset_matches, pd.Series) and isinstance(definition_matches, pd.Series):
            df[force_col] = df[force_col].astype(bool) | asset_matches | definition_matches
        elif isinstance(asset_matches, pd.Series):
            df[force_col] = df[force_col].astype(bool) | asset_matches
        elif isinstance(definition_matches, pd.Series):
            df[force_col] = df[force_col].astype(bool) | definition_matches

    add_log(
        f"Current-solution hinted players preserved: {int(df[force_col].sum())}"
    )
    # Remove All Players not matching quality first
    before_df = df
    df = df[(df["price"] > 0) | df[force_col]]
    log_filter_step(run_id, "preprocess", "drop_non_positive_price", before_df, df)
    for req in sbc["constraints"]:
        if req["requirementKey"] == "1TEAM_RATING" and len(sbc["brickIndices"]) > 0:
            sbc["constraints"].append(
                {
                    "scope": "EXACT",
                    "count": len(sbc["brickIndices"]),
                    "requirementKey": "CLUB_ID",
                    "eligibilityValues": [999],
                }
            )
            #   df = df.assign(newgroups=[[x for x in l if x in req['eligibilityValues']] for l in df['groups']])
            #   df['groups'] = df['newgroups'].apply(lambda y: [99] if y!=req['eligibilityValues'] else y)
            #   df = df[df["groups"][0] != [-1]]
        if req["requirementKey"] == "PLAYER_QUALITY":
            before_df = df
            if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                df = df[(df["ratingTier"] >= req["eligibilityValues"][0]) | df[force_col]]
            if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                df = df[(df["ratingTier"] <= req["eligibilityValues"][0]) | df[force_col]]
            log_filter_step(
                run_id,
                "preprocess",
                f"player_quality_prefilter_{req.get('scope', 'UNKNOWN')}",
                before_df,
                df,
            )

    brick_rows = len(sbc["brickIndices"])
    for i in range(brick_rows):
        # Create brick DataFrame with brick rows
        brick_data = {
            "id": i,
            "name": "BRICK{}".format(i),
            "cardType": "BRICK",
            "assetId": i,
            "definitionId": i,
            "rating": 55,
            "teamId": 999,
            "leagueId": 999,
            "nationId": 999,
            "rarityId": 999,
            "ratingTier": 999,
            "isUntradeable": "",
            "isDuplicate": "",
            "preferredPosition": "0",
            "possiblePositions": [0],
            "groups": 999,
            "isFixed": "",
            "concept": "",
            "price": 15000000,
            "futBinPrice": "",
        }

        brick_df = pd.DataFrame([brick_data])

        # Concatenate the original DataFrame with the brick DataFrame
        # df = pd.concat([df, brick_df], ignore_index=True)
    df = preprocess_data(df, sbc, run_id=run_id)
    add_log(f"Processing {len(players)} players for SBC")
    failed = False
    for req in sbc["constraints"]:
        min_required = req.get("count", 0)
        if req["requirementKey"] == "PLAYER_RARITY_GROUP":
            condition = df["groups"].apply(
                lambda g: any(
                    item in req["eligibilityValues"]
                    for item in (g if isinstance(g, list) else [g])
                )
            )
        elif req["requirementKey"] == "PLAYER_QUALITY":
            if req.get("scope") in ["GREATER", "EXACT"]:
                condition = df["ratingTier"] >= req["eligibilityValues"][0]
            elif req.get("scope") == "LOWER":
                condition = df["ratingTier"] <= req["eligibilityValues"][0]
            else:
                condition = pd.Series([True] * len(df))
        elif req["requirementKey"] == "CLUB_ID":
            condition = df["teamId"].isin(req["eligibilityValues"])
        elif req["requirementKey"] == "LEAGUE_ID":
            condition = df["leagueId"].isin(req["eligibilityValues"])
        elif req["requirementKey"] == "NATION_ID":
            condition = df["nationId"].isin(req["eligibilityValues"])
        elif req["requirementKey"] == "PLAYER_RARITY":
            condition = df["rarityId"].isin(req["eligibilityValues"])
        elif req["requirementKey"] == "PLAYER_EXACT_OVR":
            condition = df["rating"].isin(req["eligibilityValues"])
        else:
            condition = pd.Series([True] * len(df))
        count_matches = (
            condition.sum()
            if isinstance(condition, pd.Series)
            else df[condition].shape[0]
        )
        if count_matches < min_required:
            add_log(
                f"Failed requirement: {req['requirementKey']} requires at least {min_required} players, found {count_matches}."
            )
            failed = True
    if failed:
        add_log("One or more minimum requirements were not met.")
    final_players, status, status_code = optimize.SBC(df, sbc, maxSolveTime)
    failure_analysis = None
    if not final_players:
        # Always analyse why nothing was found so solve_diagnostics.json can be
        # inspected (concepts on => a solution should almost always exist).
        failure_analysis = analyze_failure_reasons(sbc, before_preprocess_df, df)
        add_log(
            "Failure analysis generated",
            [
                {
                    "failedConstraintCount": failure_analysis.get("failedConstraintCount", 0),
                    "beforePreprocessCount": failure_analysis.get("beforePreprocessCount", 0),
                    "afterPreprocessCount": failure_analysis.get("afterPreprocessCount", 0),
                }
            ],
        )
    write_solve_diagnostics(
        run_id,
        sbc,
        before_preprocess_df,
        df,
        status,
        status_code,
        solution_found=bool(final_players),
        failure_analysis=failure_analysis,
    )
    results = []
    # if status != 2 and status != 4:
    #      return "{'status': {}, 'status_code': {}}".format(status, status_code)
    if final_players:
        df_out = df.iloc[final_players].copy()
        df_out.insert(5, "Is_Pos", df_out.pop("Is_Pos"))
        df_out.insert(6, "Chemistry", df_out.pop("Chemistry"))
        print(f"Total Chemistry: {df_out['Chemistry'].sum()}")
        squad_rating = calc_squad_rating(df_out["rating"].tolist())
        print(f"Squad Rating: {squad_rating}")
        print(f"Total Cost: {df_out['price'].sum()}")
        df_out["Org_Row_ID"] = df_out["Original_Idx"] + 2
        df_out.pop("Original_Idx")
        maybe_dump_csv(df_out, "final_players.csv")
        print(sbc, status, status_code)
        results = df_out.to_json(orient="records")
        # add_log(f"Results: {results}")
        add_log(status)
        response_payload = {"results": results, "status": status, "status_code": status_code}
        if debug_failure_analysis and failure_analysis is not None:
            response_payload["failureAnalysis"] = failure_analysis
        json_compatible_item_data = jsonable_encoder(response_payload)
        return JSONResponse(content=json_compatible_item_data)
    add_log(status)
    response_payload = {"status": status, "status_code": status_code}
    if debug_failure_analysis and failure_analysis is not None:
        response_payload["failureAnalysis"] = failure_analysis
    json_compatible_item_data = jsonable_encoder(response_payload)
    return JSONResponse(content=json_compatible_item_data)


def calc_squad_rating(ratings):
    total_rating = sum(ratings)
    squad_size = len(ratings)
    excess = sum(
        rating - total_rating / 11 for rating in ratings if rating > total_rating / 11
    )
    adjusted_rating = total_rating + excess
    squad_rating = round(adjusted_rating)
    print(
        "total_rating:",
        total_rating,
        "average rating:",
        total_rating / 11,
        "squad_size:",
        squad_size,
        "adjusted_rating:",
        adjusted_rating,
        "excess:",
        excess,
        "squad_rating:",
        squad_rating,
    )
    return min(max(round(squad_rating / 11, 2), 0), 99)
