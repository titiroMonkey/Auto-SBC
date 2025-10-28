class Player:
    def __init__(self, rating):
        self.rating = rating


def calculate_squad_rating(players):
    total_rating = sum(player.rating for player in players)
    squad_size = len(players)
    excess = sum(
        player.rating - total_rating / squad_size
        for player in players
        if player.rating > total_rating / squad_size
    )
    adjusted_rating = total_rating
    squad_rating = round(adjusted_rating)
    print(
        "total_rating:",
        total_rating,
        "average rating:",
        total_rating / squad_size,
        "squad_size:",
        squad_size,
        "adjusted_rating:",
        adjusted_rating,
        "excess:",
        excess,
        "squad_rating:",
        squad_rating,
    )

    return min(max(round(squad_rating) / squad_size, 0), 99)


# Define players
players = [Player(65)] * 2 + [Player(99)] * 9

# Calculate squad rating
squad_rating = calculate_squad_rating(players)
print("Squad rating:", squad_rating)
