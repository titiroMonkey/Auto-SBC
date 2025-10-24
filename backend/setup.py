import optimize
import pandas as pd
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from logger import add_log

# Preprocess the club dataset obtained from api.


def preprocess_data(df: pd.DataFrame, sbc):
    df.to_csv("allPlayers.csv")
    groupings = []
    # Remove concept players with missing futggPrice
    df = df[~(df["concept"] & df["futggPrice"].isna())]
    df["price"] = df["price"].fillna(
        15000000
    )  # set price to 15m if missing so it will only use the player if really necessary
    df = df[df["price"] <= 50000]  # remove players with price greater than 50k
    expPP = False

    expPR = False
    rarityGroups = []
    for req in sbc["constraints"]:
        if req["count"] == 11 - len(sbc["brickIndices"]):
            # Filter the players to only include those that meet this requirement
            # since we need all players to satisfy this constraint
            add_log(
                f"Filtering players for '{req['requirementKey']}' requirement. Current player count: {len(df)}"
            )
            if req["requirementKey"] == "PLAYER_RARITY_GROUP":
                # Filter players where any element in the groups array matches any eligibility value
                df = df[
                    df["groups"].apply(
                        lambda x: any(g in req["eligibilityValues"] for g in x)
                    )
                ]
            elif req["requirementKey"] == "PLAYER_QUALITY":
                if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                    df = df[df["ratingTier"] >= req["eligibilityValues"][0]]
                if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                    df = df[df["ratingTier"] <= req["eligibilityValues"][0]]
            elif req["requirementKey"] == "CLUB_ID":
                df = df[df["teamId"].isin(req["eligibilityValues"])]
            elif req["requirementKey"] == "LEAGUE_ID":
                df = df[df["leagueId"].isin(req["eligibilityValues"])]
            elif req["requirementKey"] == "NATION_ID":
                df = df[df["nationId"].isin(req["eligibilityValues"])]
            elif req["requirementKey"] == "PLAYER_RARITY":
                df = df[df["rarityId"].isin(req["eligibilityValues"])]
            elif req["requirementKey"] == "PLAYER_EXACT_OVR":
                df = df[df["rating"].isin(req["eligibilityValues"])]

        if (
            req["requirementKey"] == "CHEMISTRY_POINTS"
            or req["requirementKey"] == "ALL_PLAYERS_CHEMISTRY_POINTS"
        ):
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
    else:
        df = df.assign(possiblePositions=0)
    if expPR:
        df["original_groups"] = df["groups"]
        df = df.assign(
            groups=[[x for x in l if x in rarityGroups] for l in df["groups"]]
        )

        df["groups"] = df["groups"].apply(lambda y: [99] if len(y) == 0 else y)
        df = df.explode("groups")
    else:
        df = df.assign(groups=0)
    # Select the cheapest players based on groupings
    groupings = list(set(groupings))  # Remove duplicates
    # Log the detected groupings

    add_log(
        f"Detected groupings for player filtering: {', '.join(groupings) if groupings else 'none'}"
    )
    # If groupings are defined, filter to keep the lowest priced players in each group
    if groupings:
        # Create a composite grouping key for each unique combination of grouping values
        if len(groupings) > 0:
            # Keep only the top 11 cheapest players for each unique grouping combination
            # First, sort by price
            df = df.sort_values("price")

            # Create a grouping key based on the identified groupings
            if len(groupings) == 1:
                group_key = df[groupings[0]].astype(str)
            else:
                group_key = df[groupings].apply(
                    lambda x: "_".join(x.astype(str)), axis=1
                )

            # Keep only the top 11 cheapest players for each group
            df = df.groupby(group_key).head(11).reset_index(drop=True)

            print(
                f"Filtered to {len(df)} players after keeping top 11 cheapest per group"
            )
    df.to_csv("filteredPlayers.csv")
    df["Original_Idx"] = df.index
    df = df.reset_index(drop=True)

    return df


def runAutoSBC(sbc, players, maxSolveTime):
    add_log("Starting SBC solver process")
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
    # Remove All Players not matching quality first
    df = df[df["price"] > 0]
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
            if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                df = df[df["ratingTier"] >= req["eligibilityValues"][0]]
            if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                df = df[df["ratingTier"] <= req["eligibilityValues"][0]]

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
    df = preprocess_data(df, sbc)
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
        df_out.to_csv("final_players.csv")
        print(sbc, status, status_code)
        results = df_out.to_json(orient="records")
        # add_log(f"Results: {results}")
        add_log(status)
        json_compatible_item_data = jsonable_encoder(
            {"results": results, "status": status, "status_code": status_code}
        )
        return JSONResponse(content=json_compatible_item_data)
    add_log(status)
    json_compatible_item_data = jsonable_encoder(
        {"status": status, "status_code": status_code}
    )
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
