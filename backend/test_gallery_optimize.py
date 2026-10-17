import unittest

from gallery_optimize import maximize_rewards


class GalleryOptimizeTest(unittest.TestCase):
    def choice(self, set_id, reward, player_id, cost):
        return {"setId": set_id, "reward": reward, "requiredCards": 1,
                "playerIds": [player_id], "purchases": [{"eaId": player_id, "cost": cost}]}

    def test_shared_purchase_and_one_grade_per_set(self):
        choices = [self.choice(1, 10, 44, 500), self.choice(1, 20, 55, 800), self.choice(2, 15, 44, 500)]
        result = maximize_rewards({"currency": "tokens", "budget": 500, "choices": choices})
        self.assertEqual(result["selectedIndexes"], [0, 2])
        self.assertEqual(result["reward"], 25)
        self.assertEqual(result["cost"], 500)
        self.assertTrue(result["optimal"])

    def test_budget_and_minimum_spend(self):
        choices = [self.choice(1, 10, 44, 500), self.choice(2, 10, 55, 400)]
        result = maximize_rewards({"currency": "gems", "budget": 500, "choices": choices})
        self.assertEqual(result["selectedIndexes"], [1])
        self.assertEqual(result["cost"], 400)

    def test_incomplete_lineup_rejected(self):
        choices = [self.choice(1, 10, 44, 400), self.choice(1, 10, 55, 500), self.choice(2, 20, 55, 500)]
        result = maximize_rewards({"currency": "tokens", "budget": 500, "choices": choices})
        self.assertEqual(result["selectedIndexes"], [1, 2])
        self.assertEqual(result["reward"], 30)

        choice = self.choice(1, 10, 44, 500)
        choice["requiredCards"] = 2
        with self.assertRaises(ValueError):
            maximize_rewards({"currency": "tokens", "budget": 500, "choices": [choice]})

    def test_empty_and_unaffordable(self):
        for choices in ([], [self.choice(1, 10, 44, 500)]):
            result = maximize_rewards({"currency": "tokens", "budget": 0, "choices": choices})
            self.assertEqual(result["reward"], 0)


if __name__ == "__main__":
    unittest.main()