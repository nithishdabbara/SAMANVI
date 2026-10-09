"""Apply numbered SQL migrations (NNN_name.sql) exactly once, in order.

Usage:  python migrate.py            (needs DATABASE_URL; DB_SSLMODE defaults to 'require')

Only files named like ``002_something.sql`` are applied; the legacy bootstrap files
(rebuild_migration.sql, safety_migration.sql, init_db.py, migrate_*.py) are NOT re-run
because some of them drop tables.  Each migration runs in its own transaction.
"""
import os
import re
import sys

import psycopg2
from dotenv import load_dotenv

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")
_NAME = re.compile(r"^\d{3}_[\w\-]+\.sql$")


def pending_files():
    return sorted(f for f in os.listdir(MIGRATIONS_DIR) if _NAME.match(f))


def apply_migrations(conn, verbose=True):
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())")
    conn.commit()
    cur.execute("SELECT version FROM schema_migrations")
    done = {r[0] for r in cur.fetchall()}
    applied = []
    for name in pending_files():
        if name in done:
            continue
        with open(os.path.join(MIGRATIONS_DIR, name), encoding="utf-8") as fh:
            sql = fh.read()
        try:
            cur.execute(sql)
            cur.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (name,))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        applied.append(name)
        if verbose:
            print(f"applied {name}")
    cur.close()
    return applied


def main():
    load_dotenv()
    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set")
    conn = psycopg2.connect(url, sslmode=os.getenv("DB_SSLMODE", "require"))
    try:
        applied = apply_migrations(conn)
        print("up to date" if not applied else f"{len(applied)} migration(s) applied")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
