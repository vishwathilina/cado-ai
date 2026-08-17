import unittest
from datetime import date, timedelta

from app.utils import calculate_streak, chunk_text


class ChunkTextTests(unittest.TestCase):
    def test_normalizes_and_chunks_with_overlap(self) -> None:
        text = " ".join(f"word{index}" for index in range(100))
        chunks = chunk_text(text, size=120, overlap=20)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(chunk) <= 120 for chunk in chunks))
        self.assertNotIn("  ", " ".join(chunks))

    def test_empty_input_has_no_chunks(self) -> None:
        self.assertEqual(chunk_text(" \n\t "), [])


class StreakTests(unittest.TestCase):
    def test_counts_consecutive_days_including_today(self) -> None:
        today = date(2026, 8, 17)
        days = [today - timedelta(days=offset) for offset in (0, 1, 2, 5)]
        self.assertEqual(calculate_streak(days, today), 3)

    def test_allows_streak_to_continue_from_yesterday(self) -> None:
        today = date(2026, 8, 17)
        days = [today - timedelta(days=1), today - timedelta(days=2)]
        self.assertEqual(calculate_streak(days, today), 2)

    def test_old_activity_is_not_current_streak(self) -> None:
        today = date(2026, 8, 17)
        self.assertEqual(calculate_streak([today - timedelta(days=3)], today), 0)


if __name__ == "__main__":
    unittest.main()
