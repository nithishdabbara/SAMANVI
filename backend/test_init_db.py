import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Import the init_db module
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import init_db

class TestInitDB(unittest.TestCase):

    @patch('init_db.psycopg2.connect')
    @patch('init_db.os.getenv')
    def test_missing_database_url(self, mock_getenv, mock_connect):
        mock_getenv.return_value = None
        
        with self.assertRaises(SystemExit) as cm:
            init_db.create_tables()
            
        self.assertEqual(cm.exception.code, 1)
        mock_connect.assert_not_called()

    @patch('init_db.psycopg2.connect')
    @patch('init_db.os.getenv')
    @patch('apply_rebuild_migration.run_migration')
    @patch('sys.argv', ['init_db.py'])
    def test_safe_initialization_no_drops(self, mock_migration, mock_getenv, mock_connect):
        mock_getenv.return_value = 'fake_url'
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        # Mock the post-migration check
        mock_cur.fetchone.return_value = {"column_name": "resolved_at"}
        
        init_db.create_tables()
        
        # Verify no DROP TABLE statements executed
        calls = mock_cur.execute.call_args_list
        drop_calls = [c for c in calls if 'DROP TABLE' in c[0][0]]
        self.assertEqual(len(drop_calls), 0)
        
        # Verify CREATE TABLE executed
        create_calls = [c for c in calls if 'CREATE TABLE' in c[0][0]]
        self.assertGreater(len(create_calls), 0)
        
        mock_migration.assert_called_once()
        mock_conn.commit.assert_called()
        mock_conn.close.assert_called()

    @patch('init_db.psycopg2.connect')
    @patch('init_db.os.getenv')
    @patch('apply_rebuild_migration.run_migration')
    @patch('sys.argv', ['init_db.py', '--destructive-reset'])
    def test_destructive_reset_executes_drops(self, mock_migration, mock_getenv, mock_connect):
        mock_getenv.return_value = 'fake_url'
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        mock_cur.fetchone.return_value = {"column_name": "resolved_at"}
        
        init_db.create_tables()
        
        # Verify DROP TABLE statements DID execute
        calls = mock_cur.execute.call_args_list
        drop_calls = [c for c in calls if 'DROP TABLE' in c[0][0]]
        self.assertGreater(len(drop_calls), 0)
        
        mock_migration.assert_called_once()
        mock_conn.commit.assert_called()
        mock_conn.close.assert_called()

    @patch('init_db.psycopg2.connect')
    @patch('init_db.os.getenv')
    @patch('apply_rebuild_migration.run_migration')
    @patch('sys.argv', ['init_db.py'])
    def test_migration_failure_propagates(self, mock_migration, mock_getenv, mock_connect):
        mock_getenv.return_value = 'fake_url'
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        # Simulate a migration script failure
        mock_migration.side_effect = Exception("Migration script failed!")
        
        with self.assertRaises(Exception) as context:
            init_db.create_tables()
            
        self.assertIn("Migration script failed!", str(context.exception))
        mock_conn.close.assert_called()

    @patch('init_db.psycopg2.connect')
    @patch('init_db.os.getenv')
    @patch('apply_rebuild_migration.run_migration')
    @patch('sys.argv', ['init_db.py'])
    def test_resolved_at_verification_failure(self, mock_migration, mock_getenv, mock_connect):
        mock_getenv.return_value = 'fake_url'
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        
        # Simulate missing column after migration
        mock_cur.fetchone.return_value = None
        
        with self.assertRaises(Exception) as context:
            init_db.create_tables()
            
        self.assertIn("Critical Failure: public.problems.resolved_at does not exist after migration", str(context.exception))
        mock_conn.close.assert_called()

if __name__ == '__main__':
    unittest.main()

