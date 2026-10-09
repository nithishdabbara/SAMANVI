import unittest
from unittest.mock import patch, MagicMock
import os
import sys

os.environ['JWT_SECRET_KEY'] = '1234567890123456789012345678901234'
os.environ['DATABASE_URL'] = 'postgresql://fake'

import app
import sprint

class Phase2Tests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()
        self.client.testing = True

    @patch('app.get_db_connection')
    def test_registration_without_verification_rejected(self, mock_db):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None # No OTP session found
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn

        res = self.client.post('/api/auth/register', json={
            "email": "test@test.com", "password": "PassPassword123!", "name": "Test Name", 
            "phone": "9999999999", "latitude": 22.0, "longitude": 73.0, "role_id": 1, "home_lat": 22.0, "home_lon": 73.0
        })
        print(res.json)
        self.assertEqual(res.status_code, 403)
        self.assertIn("Registration rejected", res.json['error'])

    @patch('app.get_db_connection')
    def test_home_verified_cannot_be_set_by_client(self, mock_db):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        # Side effect: 1. Phone OTP check (returns valid id) 2. Email duplicate check (returns None) 3. Phone duplicate check (returns None)
        mock_cursor.fetchone.side_effect = [{"id": 1}, None, None, {"id": 1, "email": "a", "name": "a", "full_name": "a", "nickname": "a"}]
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn

        res = self.client.post('/api/auth/register', json={
            "email": "test2@test.com", "password": "PassPassword123!", "name": "Test Name", 
            "phone": "9999999999", "latitude": 22.0, "longitude": 73.0, "home_verified": True
        })
        print(res.json)
        
        calls = mock_cursor.execute.call_args_list
        insert_call = next((call for call in calls if "INSERT INTO users" in call[0][0]), None)
        self.assertIsNotNone(insert_call)
        self.assertIn("FALSE", insert_call[0][0])
        
    @patch('app.get_db_connection')
    def test_login_invalid_credentials(self, mock_db):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None # User not found
        mock_conn.cursor.return_value = mock_cursor
        mock_db.return_value = mock_conn
        
        res = self.client.post('/api/auth/login', json={
            "email": "wrong@test.com", "password": "wrong"
        })
        self.assertEqual(res.status_code, 401)
        self.assertIn("Invalid email/phone or password", res.json['error'])

if __name__ == '__main__':
    unittest.main()
