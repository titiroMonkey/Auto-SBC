import optimize
import pandas as pd
from fastapi import Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from globals import add_log

# Preprocess the club dataset obtained from api.

def preprocess_data(df: pd.DataFrame,sbc):
    df['price']= df['price'].fillna(15000000) #set price to 15m if missing so it will only use the player if really necessary
    expPP=False
    expPR=False
    rarityGroups=[]
    for req in sbc['constraints']:
        if req['requirementKey'] == 'CHEMISTRY_POINTS' or req['requirementKey'] == 'ALL_PLAYERS_CHEMISTRY_POINTS':
            expPP=True        
        if req['requirementKey'] == 'PLAYER_RARITY_GROUP':
            expPR=True        
            rarityGroups= rarityGroups + req['eligibilityValues']  
            
              # Creating separate entries of a particular player for each alternate position.
    if expPP:
        df = df.assign(possiblePositions=[[x for x in l if x in sbc['formation']] for l in df['possiblePositions']])
        df['possiblePositions'] = df['possiblePositions'].apply(lambda y: [99] if len(y)==0 else y)
        
        df = df.explode('possiblePositions')
    else:
        df = df.assign(possiblePositions=0)
    if expPR:
      
        df = df.assign(groups=[[x for x in l if x in rarityGroups] for l in df['groups']])
      
        df['groups'] = df['groups'].apply(lambda y: [99] if len(y)==0 else y)
        df = df.explode('groups')
    else:
        df = df.assign(groups=0)

    df.to_csv("allPlayers.csv")
    df['Original_Idx'] = df.index
    df = df.reset_index(drop = True)

    return df


def runAutoSBC(sbc,players,maxSolveTime):
    add_log("Starting SBC solver process")
    print(sbc)
    df = pd.json_normalize(players)
    # Remove All Players not matching quality first
    df = df[df["price"] > 0]
    for req in sbc['constraints']:
        if req['requirementKey'] == '1TEAM_RATING' and len(sbc['brickIndices'])>0:
            sbc['constraints'].append({'scope': 'EXACT', 'count': len(sbc['brickIndices']), 'requirementKey': 'CLUB_ID', 'eligibilityValues': [999]})
            #   df = df.assign(newgroups=[[x for x in l if x in req['eligibilityValues']] for l in df['groups']])
            #   df['groups'] = df['newgroups'].apply(lambda y: [99] if y!=req['eligibilityValues'] else y)
            #   df = df[df["groups"][0] != [-1]]
        if req['requirementKey'] == 'PLAYER_QUALITY':
                if req['scope']=='GREATER' or req['scope']=='EXACT':
                    df = df[df["ratingTier"] >= req['eligibilityValues'][0]]
                if req['scope']=='LOWER' or req['scope']=='EXACT':
                    df = df[df["ratingTier"] <= req['eligibilityValues'][0]]
   
    
    brick_rows = len(sbc['brickIndices'])
    for i in range(brick_rows):
    # Create brick DataFrame with brick rows
        brick_data = {'id': i, 'name': 'BRICK{}'.format(i), 'cardType': 'BRICK', 'assetId': i, 'definitionId': i, 'rating': 55, 'teamId': 999, 'leagueId': 999, 'nationId': 999, 
'rarityId': 999, 'ratingTier': 999, 'isUntradeable': '', 'isDuplicate': '', 'preferredPosition': '0', 'possiblePositions': [0], 'groups': 999 , 'isFixed': '', 'concept': '', 'price': 15000000, 'futBinPrice': ''}
              
       
        brick_df = pd.DataFrame([brick_data])
        
        # Concatenate the original DataFrame with the brick DataFrame
        # df = pd.concat([df, brick_df], ignore_index=True)   
    df = preprocess_data(df,sbc)
    add_log(f"Processing {len(players)} players for SBC")
    final_players,status,status_code = optimize.SBC(df,sbc,maxSolveTime)
    results=[]
    # if status != 2 and status != 4:
    #      return "{'status': {}, 'status_code': {}}".format(status, status_code)
    if final_players:
        df_out = df.iloc[final_players].copy()
        df_out.insert(5, 'Is_Pos', df_out.pop('Is_Pos'))
        print(f"Total Chemistry: {df_out['Chemistry'].sum()}")
        squad_rating = calc_squad_rating(df_out["rating"].tolist())
        print(f"Squad Rating: {squad_rating}")
        print(f"Total Cost: {df_out['price'].sum()}")
        df_out['Org_Row_ID'] = df_out['Original_Idx'] + 2
        df_out.pop('Original_Idx')
        df_out.to_csv("final_players.csv")
        print(sbc, status, status_code)
        results = df_out.to_json(orient="records")
        # add_log(f"Results: {results}")
        add_log(status)
        json_compatible_item_data = jsonable_encoder({'results':results,'status':status,'status_code':status_code})
        return JSONResponse(content=json_compatible_item_data)
    add_log(status)
    json_compatible_item_data = jsonable_encoder({'status':status,'status_code':status_code})
    return JSONResponse(content=json_compatible_item_data)





def calc_squad_rating(ratings):
    total_rating = sum(ratings)
    squad_size = len(ratings)
    excess = sum(rating - total_rating/11 for rating in ratings if rating > total_rating/11)
    adjusted_rating = total_rating + excess
    squad_rating = round(adjusted_rating)
    print("total_rating:", total_rating,"average rating:", total_rating/11,"squad_size:", squad_size, "adjusted_rating:", adjusted_rating, "excess:", excess, "squad_rating:", squad_rating)
    return min(max(round(squad_rating / 11,2), 0), 99)
