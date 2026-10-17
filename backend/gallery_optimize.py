"""CP-SAT reward portfolio selection over complete Gallery lineup choices."""

from ortools.sat.python import cp_model


def maximize_rewards(payload):
    budget = payload.get("budget")
    if isinstance(budget, bool) or not isinstance(budget, int) or not 0 <= budget <= 1_000_000_000:
        raise ValueError("budget must be a non-negative integer")
    if payload.get("currency") not in ("gems", "tokens"):
        raise ValueError("currency must be gems or tokens")
    choices = payload.get("choices", [])
    if not isinstance(choices, list) or len(choices) > 100_000:
        raise ValueError("at most 100000 choices are supported")
    model = cp_model.CpModel()
    selected = []
    groups = {}
    costs = {}
    buyers = {}
    for index, choice in enumerate(choices):
        reward = choice.get("reward")
        if isinstance(reward, bool) or not isinstance(reward, int) or not 0 <= reward <= 1_000_000:
            raise ValueError("reward must be a non-negative integer")
        players = choice.get("playerIds", [])
        required = choice.get("requiredCards")
        if not isinstance(required, int) or required <= 0 or len(set(players)) != required or len(players) != required:
            raise ValueError("every choice must contain a complete, unique lineup")
        variable = model.NewBoolVar(f"choice_{index}")
        selected.append(variable)
        groups.setdefault(str(choice["setId"]), []).append(variable)
        for purchase in choice.get("purchases", []):
            player_id = str(purchase["eaId"])
            cost = purchase.get("cost")
            if not isinstance(cost, int) or isinstance(cost, bool) or not 0 < cost <= 1_000_000_000:
                raise ValueError("purchase cost must be a positive integer")
            if player_id not in {str(player) for player in players}:
                raise ValueError("purchased player must belong to the lineup")
            if player_id in costs and costs[player_id] != cost:
                raise ValueError("shared player prices must agree")
            costs[player_id] = cost
            buyers.setdefault(player_id, []).append(variable)
    for variables in groups.values():
        model.Add(sum(variables) <= 1)
    purchase_vars = {}
    for player_id, variables in buyers.items():
        purchased = model.NewBoolVar(f"buy_{player_id}")
        model.AddMaxEquality(purchased, variables)
        purchase_vars[player_id] = purchased
    spend = sum(costs[player_id] * variable for player_id, variable in purchase_vars.items())
    rewards = sum(choice["reward"] * variable for choice, variable in zip(choices, selected))
    model.Add(spend <= budget)
    model.Maximize(rewards * (budget + 1) - spend)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30
    solver.parameters.num_search_workers = 4
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": solver.StatusName(status), "selectedIndexes": [], "reward": 0, "cost": 0, "optimal": False}
    indexes = [index for index, variable in enumerate(selected) if solver.Value(variable)]
    total_cost = sum(costs[player_id] for player_id, variable in purchase_vars.items() if solver.Value(variable))
    return {
        "status": solver.StatusName(status),
        "selectedIndexes": indexes,
        "reward": sum(choices[index]["reward"] for index in indexes),
        "cost": total_cost,
        "optimal": status == cp_model.OPTIMAL,
        "wallTime": solver.WallTime(),
        "scope": "supplied complete lineup choices",
    }