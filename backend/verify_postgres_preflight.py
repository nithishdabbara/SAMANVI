"""Verify db_preflight.py against an isolated PostgreSQL 16.2 engine."""
import os
import sys
import tempfile
import psycopg2
from psycopg2.extras import RealDictCursor
import pgserver
import db_preflight

def test_isolated_db_preflight():
    print("======================================================================")
    print("STAGE 3.3: ISOLATED POSTGRESQL 16.2 DATABASE PREFLIGHT VERIFICATION")
    print("======================================================================")

    tmpdir = tempfile.mkdtemp()
    srv = None
    try:
        srv = pgserver.get_server(tmpdir)
        conn_uri = srv.get_uri()
        print(f"[ENVIRONMENT] Native PostgreSQL 16.2 running at isolated socket.")

        # Test 1: Connectivity check
        connected, msg = db_preflight.check_db_connectivity(conn_uri, sslmode="disable")
        assert connected is True, f"Connectivity check failed: {msg}"
        print("[PASS] Test 1: check_db_connectivity succeeded against native PostgreSQL 16.2.")

        # Test 2: Schema check on empty database (must detect missing required tables)
        conn = psycopg2.connect(conn_uri)
        schema_state = db_preflight.check_schema_state(conn)
        assert schema_state["ok"] is False, "Empty DB should not be schema ready"
        assert len(schema_state["missing_tables"]) == len(db_preflight.REQUIRED_TABLES), "All tables should be missing"
        print(f"[PASS] Test 2: check_schema_state detected missing tables: {schema_state['missing_tables']}.")

        # Test 3: Initialize tables and migrations table
        cur = conn.cursor()
        cur.execute("CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());")
        cur.execute("INSERT INTO schema_migrations (version) VALUES ('002_security_hardening.sql'), ('003_push_tokens.sql');")
        for table in db_preflight.REQUIRED_TABLES:
            cur.execute(f"CREATE TABLE {table} (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ DEFAULT NOW());")
        # Add critical columns
        cur.execute("ALTER TABLE notifications ADD COLUMN idempotency_key TEXT, ADD COLUMN push_status TEXT, ADD COLUMN push_attempts INT DEFAULT 0;")
        cur.execute("ALTER TABLE push_tokens ADD COLUMN user_id UUID, ADD COLUMN token TEXT, ADD COLUMN is_active BOOLEAN DEFAULT TRUE;")
        cur.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user', ADD COLUMN is_active BOOLEAN DEFAULT TRUE;")
        conn.commit()

        # Test 4: Schema check on populated database (must be ready)
        schema_state_ready = db_preflight.check_schema_state(conn)
        conn.close()

        assert schema_state_ready["ok"] is True, f"Schema should be ok, missing: {schema_state_ready['missing_tables']}"
        assert schema_state_ready["schema_ready"] is True, "Schema should be fully ready"
        assert len(schema_state_ready["missing_tables"]) == 0, "No tables should be missing"
        assert "003_push_tokens.sql" in schema_state_ready["applied_migrations"], "003 migration should be listed"
        print("[PASS] Test 3: check_schema_state confirmed complete schema and applied migrations.")

        # Test 5: Full run_preflight_check integration
        preflight_result = db_preflight.run_preflight_check(conn_uri, sslmode="disable")
        assert preflight_result["ok"] is True
        assert preflight_result["connected"] is True
        assert preflight_result["schema_ready"] is True
        print("[PASS] Test 4: run_preflight_check returned full health and readiness status.")

        print("======================================================================")
        print("ALL 4 ISOLATED POSTGRESQL 16.2 PREFLIGHT TESTS PASSED (0 FAILURES)")
        print("======================================================================")
        return True
    finally:
        if srv:
            try:
                srv.cleanup()
            except Exception:
                pass


if __name__ == "__main__":
    success = test_isolated_db_preflight()
    if not success:
        sys.exit(1)
