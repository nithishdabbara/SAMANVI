"""Samanvi Non-Destructive Database Preflight & Schema State Verifier.

Verifies database connectivity and required schema state before application startup.
Guarantees:
- Never executes destructive migrations (DROP, TRUNCATE, ALTER TABLE DROP).
- Never modifies data during checks.
- Sanitizes connection strings to prevent credential exposure in logs or terminal output.
- Checks presence of required tables, critical columns, and migration tracking.
"""

import os
import re
import sys
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("samanvi.db_preflight")

REQUIRED_TABLES = [
    "users",
    "problems",
    "notifications",
    "push_tokens",
    "reviews",
    "categories"
]

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")
_MIGRATION_FILE_PATTERN = re.compile(r"^\d{3}_[\w\-]+\.sql$")


def sanitize_db_url(url: str) -> str:
    """Mask password in PostgreSQL URL for safe logging."""
    if not url:
        return "<unset>"
    # Pattern: postgresql://user:password@host...
    return re.sub(r":([^:@]+)@", r":***@", url)


def check_db_connectivity(db_url: str = None, sslmode: str = None, timeout_seconds: int = 5) -> tuple[bool, str]:
    """Test basic PostgreSQL connectivity with a short timeout without modifying state."""
    url = db_url or os.getenv("DATABASE_URL")
    if not url:
        return False, "DATABASE_URL is not set."

    ssl = sslmode or os.getenv("DB_SSLMODE", "require")
    try:
        conn = psycopg2.connect(
            url,
            sslmode=ssl,
            connect_timeout=timeout_seconds
        )
        cur = conn.cursor()
        cur.execute("SELECT 1;")
        cur.fetchone()
        cur.close()
        conn.close()
        return True, "Database reachable and responsive."
    except Exception as e:
        # Sanitize any connection string leakage in error message
        err_msg = sanitize_db_url(str(e))
        return False, f"Database connectivity failed: {err_msg}"


def check_schema_state(conn) -> dict:
    """Inspect database schema non-destructively to ensure required tables and columns exist."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Fetch existing public tables
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
    """)
    existing_tables = {row['table_name'] for row in cur.fetchall()}

    missing_tables = [t for t in REQUIRED_TABLES if t not in existing_tables]

    # 2. Check schema_migrations tracking
    has_migration_table = "schema_migrations" in existing_tables
    applied_migrations = []
    pending_migrations = []

    if has_migration_table:
        cur.execute("SELECT version FROM schema_migrations ORDER BY version;")
        applied_migrations = [row['version'] for row in cur.fetchall()]

    if os.path.exists(MIGRATIONS_DIR):
        available = sorted(f for f in os.listdir(MIGRATIONS_DIR) if _MIGRATION_FILE_PATTERN.match(f))
        pending_migrations = [m for m in available if m not in applied_migrations]

    # 3. Check critical columns on Stage 3.2+ tables if present
    column_checks = {}
    if "notifications" in existing_tables:
        cur.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'notifications';
        """)
        notif_cols = {r['column_name'] for r in cur.fetchall()}
        column_checks["notifications"] = {
            "has_idempotency_key": "idempotency_key" in notif_cols,
            "has_push_status": "push_status" in notif_cols or "status" in notif_cols,
            "has_push_attempts": "push_attempts" in notif_cols
        }

    if "push_tokens" in existing_tables:
        cur.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'push_tokens';
        """)
        token_cols = {r['column_name'] for r in cur.fetchall()}
        column_checks["push_tokens"] = {
            "has_user_id": "user_id" in token_cols,
            "has_token": "token" in token_cols,
            "has_is_active": "is_active" in token_cols
        }

    cur.close()

    schema_ready = (
        len(missing_tables) == 0 and
        has_migration_table and
        len(pending_migrations) == 0
    )

    return {
        "ok": len(missing_tables) == 0,
        "schema_ready": schema_ready,
        "existing_tables": sorted(list(existing_tables)),
        "missing_tables": missing_tables,
        "has_migration_table": has_migration_table,
        "applied_migrations": applied_migrations,
        "pending_migrations": pending_migrations,
        "column_checks": column_checks
    }


def run_preflight_check(db_url: str = None, sslmode: str = None) -> dict:
    """Run full non-destructive database and schema preflight check."""
    connected, conn_msg = check_db_connectivity(db_url, sslmode)
    if not connected:
        return {
            "ok": False,
            "connected": False,
            "schema_ready": False,
            "error": conn_msg
        }

    url = db_url or os.getenv("DATABASE_URL")
    ssl = sslmode or os.getenv("DB_SSLMODE", "require")
    try:
        conn = psycopg2.connect(url, sslmode=ssl, connect_timeout=5)
        schema_info = check_schema_state(conn)
        conn.close()
        return {
            "ok": schema_info["ok"],
            "connected": True,
            "schema_ready": schema_info["schema_ready"],
            "details": schema_info
        }
    except Exception as e:
        return {
            "ok": False,
            "connected": False,
            "schema_ready": False,
            "error": sanitize_db_url(str(e))
        }


if __name__ == '__main__':
    url = os.getenv("DATABASE_URL")
    ssl = os.getenv("DB_SSLMODE", "require")
    print("Running Samanvi Database Preflight Check...")
    print(f"Target Database: {sanitize_db_url(url)} (sslmode: {ssl})")

    res = run_preflight_check(url, ssl)
    if not res["connected"]:
        print(f"\n[PREFLIGHT FAILED - CONNECTIVITY] {res.get('error')}")
        sys.exit(1)

    details = res.get("details", {})
    if not res["ok"]:
        print("\n[PREFLIGHT FAILED - MISSING TABLES]")
        print(f"Missing required tables: {details.get('missing_tables')}")
        print("Run database initialization or migrations before starting the application:")
        print("  python backend/migrate.py")
        sys.exit(2)

    if details.get("pending_migrations"):
        print(f"\n[WARNING] Pending migrations detected: {details.get('pending_migrations')}")
        print("Apply migrations using: python backend/migrate.py")
    else:
        print("\n[PREFLIGHT SUCCESS] Database connected and all required tables/migrations verified.")

    sys.exit(0)
