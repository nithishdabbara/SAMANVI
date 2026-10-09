"""
Migration stub: add emergency_contacts table.

This file exists so that backend/tests/conftest.py can extract the
CREATE TABLE DDL via _ddl_from_script() without requiring a running
database. The actual idempotent migration is in
migrations/004_emergency_contacts.sql (applied by migrate.py).

To apply to an existing database:
    python migrate.py
"""

DDL = """
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""
