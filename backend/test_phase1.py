import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Ensure JWT_SECRET_KEY is set before importing app
os.environ['JWT_SECRET_KEY'] = '1234567890123456789012345678901234'
os.environ['DATABASE_URL'] = 'postgresql://fake'

import app
import sprint

class Phase1Tests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()
        self.client.testing = True

    def test_routes_registered(self):
        routes = [rule.rule for rule in app.app.url_map.iter_rules()]
        self.assertIn('/api/safety/sos', routes)
        self.assertIn('/api/auth/verify-phone-otp', routes)
        self.assertIn('/api/auth/verify-aadhaar-otp', routes)
        # Check sprint routes are registered (no duplicate blueprint checks handled by Flask inherently)
        
    @patch('sprint.get_db_connection')
    def test_phone_otp_rejects_incorrect(self, mock_db):
        # Mock DB to return None (no session found)
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn

        res = self.client.post('/api/auth/verify-phone-otp', json={"phone": "+919999999999", "otp": "999999"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid or expired OTP", res.json['error'])

    @patch('sprint.get_db_connection')
    def test_phone_otp_rejects_hardcoded_bypass(self, mock_db):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn

        # Test the old 123456 bypass
        res = self.client.post('/api/auth/verify-phone-otp', json={"phone": "+919999999999", "otp": "123456"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid or expired OTP", res.json['error'])

    @patch('sprint.get_db_connection')
    def test_aadhaar_no_dev_otp(self, mock_db):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn

        res = self.client.post('/api/auth/send-aadhaar-otp', json={"aadhaar": "123412341234"})
        # Should not return dev_otp
        self.assertNotIn("dev_otp", res.json)
        self.assertEqual(res.status_code, 200)

if __name__ == '__main__':
    unittest.main()
