"""Samanvi Production Configuration & Startup Safeguards Validator.

Enforces strict environment variable validation, guards against weak or placeholder
secrets, rejects non-production mock modes in production environments, and ensures
that sensitive values (passwords, tokens, keys) are NEVER leaked into error messages or logs.
"""

import os
import re
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger("samanvi.config")

# Known insecure/placeholder secrets that must NEVER be used in production
WEAK_SECRETS = {
    "super-secret-key-for-samanvi",
    "secret",
    "secretkey",
    "changeme",
    "change-me",
    "your-secret-key",
    "password",
    "123456",
    "test",
    "jwt_secret_key",
    "admin",
    "default",
}

_TRUTHY_VALUES = {"1", "true", "yes", "t", "y"}


def is_truthy(val) -> bool:
    """Return True if string represents a truthy flag."""
    if val is None:
        return False
    return str(val).strip().lower() in _TRUTHY_VALUES


def is_production(env: dict = None) -> bool:
    """Determine if running in production mode."""
    if env is None:
        env = os.environ
    app_env = env.get("APP_ENV", "production").strip().lower()
    return app_env in ("production", "prod")


def validate_config(env: dict = None) -> tuple[bool, list[str]]:
    """Validate application configuration against startup requirements and security safeguards.
    
    Returns:
        (is_valid: bool, errors: list[str])
    
    Guarantees:
    - Never prints or includes sensitive secret values in errors or logs.
    - Rejects development mock modes in production (PUSH_MOCK_MODE, AADHAAR_MOCK_MODE, ALLOW_DEV_OTP).
    - Requires strong JWT_SECRET_KEY (length >= 32 in production, not in placeholder list).
    - Requires valid Fernet MESSAGE_ENCRYPTION_KEY.
    - Requires DATABASE_URL pointing to PostgreSQL.
    """
    if env is None:
        env = os.environ

    errors = []
    prod = is_production(env)

    # 1. JWT_SECRET_KEY validation
    jwt_secret = env.get("JWT_SECRET_KEY", "").strip()
    if not jwt_secret:
        errors.append("JWT_SECRET_KEY is required and cannot be empty.")
    elif jwt_secret.lower() in WEAK_SECRETS:
        errors.append("JWT_SECRET_KEY is using an insecure default or placeholder value.")
    elif prod and len(jwt_secret) < 32:
        errors.append(f"JWT_SECRET_KEY is too short for production (minimum length: 32, current length: {len(jwt_secret)}).")
    elif not prod and len(jwt_secret) < 16:
        errors.append(f"JWT_SECRET_KEY is too short (minimum length: 16, current length: {len(jwt_secret)}).")

    # 2. MESSAGE_ENCRYPTION_KEY validation
    enc_key = env.get("MESSAGE_ENCRYPTION_KEY", "").strip()
    if not enc_key:
        errors.append("MESSAGE_ENCRYPTION_KEY is required and cannot be empty.")
    elif enc_key.lower() in WEAK_SECRETS:
        errors.append("MESSAGE_ENCRYPTION_KEY cannot be a weak placeholder value.")
    else:
        try:
            Fernet(enc_key.encode("utf-8"))
        except Exception:
            errors.append(
                "MESSAGE_ENCRYPTION_KEY is not a valid 32-byte URL-safe base64-encoded Fernet key "
                "(generate with python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")."
            )

    # 3. DATABASE_URL validation
    db_url = env.get("DATABASE_URL", "").strip()
    if not db_url:
        errors.append("DATABASE_URL is required and cannot be empty.")
    elif not (db_url.startswith("postgresql://") or db_url.startswith("postgres://")):
        errors.append("DATABASE_URL must be a valid PostgreSQL connection URI (postgresql://...).")

    # 4. Strict Production Mock & Debug Safeguards
    if prod:
        if is_truthy(env.get("PUSH_MOCK_MODE")):
            errors.append("Security violation: PUSH_MOCK_MODE is strictly forbidden in production.")

        if is_truthy(env.get("AADHAAR_MOCK_MODE")):
            errors.append("Security violation: AADHAAR_MOCK_MODE is strictly forbidden in production.")

        if is_truthy(env.get("ALLOW_DEV_OTP")):
            errors.append("Security violation: ALLOW_DEV_OTP is strictly forbidden in production.")

        if is_truthy(env.get("FLASK_DEBUG")):
            errors.append("Security violation: FLASK_DEBUG must be 0/disabled in production.")

        # In production, check DB_SSLMODE recommendation
        sslmode = env.get("DB_SSLMODE", "").strip().lower()
        if sslmode == "disable" and not is_truthy(env.get("ALLOW_INSECURE_DB")):
            errors.append("Insecure database configuration: DB_SSLMODE cannot be 'disable' in production without ALLOW_INSECURE_DB=true.")

        # Check INTERNAL_SERVICE_KEY if configured in production
        service_key = env.get("INTERNAL_SERVICE_KEY", "").strip()
        if service_key:
            if service_key.lower() in WEAK_SECRETS:
                errors.append("INTERNAL_SERVICE_KEY is set to a weak placeholder.")
            elif len(service_key) < 32:
                errors.append(f"INTERNAL_SERVICE_KEY must be at least 32 characters in production (current length: {len(service_key)}).")

    # 5. Token Lifetimes
    access_token_days = env.get("JWT_ACCESS_TOKEN_DAYS", "7").strip()
    try:
        days = int(access_token_days)
        if days <= 0 or days > 365:
            errors.append(f"JWT_ACCESS_TOKEN_DAYS must be between 1 and 365 (received: {days}).")
    except ValueError:
        errors.append("JWT_ACCESS_TOKEN_DAYS must be a valid integer.")

    return len(errors) == 0, errors


def validate_or_exit(env: dict = None):
    """Validate configuration. If invalid, log non-sensitive errors and raise RuntimeError."""
    is_valid, errors = validate_config(env)
    if not is_valid:
        error_msg = f"Startup configuration validation failed with {len(errors)} error(s): " + " | ".join(errors)
        logger.error(error_msg)
        raise RuntimeError(error_msg)
    logger.info("Startup configuration validated successfully (mode: %s).", "production" if is_production(env) else "development")


def get_sanitized_summary(env: dict = None) -> dict:
    """Return a sanitized dictionary of runtime settings safe for logging and diagnostics (NO secrets)."""
    if env is None:
        env = os.environ
    prod = is_production(env)
    return {
        "app_env": "production" if prod else env.get("APP_ENV", "development"),
        "jwt_secret_configured": bool(env.get("JWT_SECRET_KEY")),
        "message_encryption_configured": bool(env.get("MESSAGE_ENCRYPTION_KEY")),
        "database_configured": bool(env.get("DATABASE_URL")),
        "db_sslmode": env.get("DB_SSLMODE", "require" if prod else "disable"),
        "push_mock_mode": is_truthy(env.get("PUSH_MOCK_MODE")),
        "aadhaar_mock_mode": is_truthy(env.get("AADHAAR_MOCK_MODE")),
        "allow_dev_otp": is_truthy(env.get("ALLOW_DEV_OTP")),
        "enable_push_worker": is_truthy(env.get("ENABLE_PUSH_WORKER", "true")),
        "fcm_project_configured": bool(env.get("FCM_PROJECT_ID") or env.get("FIREBASE_PROJECT_ID")),
        "fcm_static_token_configured": bool(env.get("FCM_OAUTH2_ACCESS_TOKEN")),
        "internal_service_key_configured": bool(env.get("INTERNAL_SERVICE_KEY")),
    }


if __name__ == '__main__':
    import sys
    print("Validating configuration from environment...")
    valid, errs = validate_config()
    summary = get_sanitized_summary()
    print("Sanitized Configuration Summary:")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    if valid:
        print("\n[SUCCESS] Configuration is valid for startup.")
        sys.exit(0)
    else:
        print(f"\n[FAILURE] Found {len(errs)} configuration error(s):")
        for e in errs:
            print(f"  - {e}")
        sys.exit(1)
