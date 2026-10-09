import unittest

from utils.credit_cap import build_credit_cap_reached_payload


class CreditCapPayloadMessageTest(unittest.TestCase):
    def test_daily_cap_message_is_chinese(self):
        payload = build_credit_cap_reached_payload({"plan": "free"})

        self.assertIn("每日点数额度上限", payload["message"])
        self.assertIn("充值钱包点数", payload["message"])

    def test_pro_monthly_cap_message_is_chinese(self):
        payload = build_credit_cap_reached_payload(
            {"plan": "pro", "cap_scope": "monthly"}
        )

        self.assertIn("Pro 月度点数额度上限", payload["message"])
        self.assertIn("充值钱包点数", payload["message"])

    def test_broke_pro_message_is_chinese(self):
        payload = build_credit_cap_reached_payload(
            {"plan": "pro", "broke": True}
        )

        self.assertIn("今日免费点数额度上限", payload["message"])
        self.assertIn("中午 12:00 重置", payload["message"])