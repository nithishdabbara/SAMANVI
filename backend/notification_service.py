"""Samanvi Notification & Push Service (FCM & Expo).

Handles in-app notification persistence, atomic deduplication, device token registration,
dual-mode push dispatching (Expo Push Service & direct FCM), stale token pruning,
crash recovery for pending pushes, and production mock isolation.
"""

import os
import json
import logging
import threading
import time
from datetime import datetime, timezone
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("samanvi.notifications")

# Test queue for automated test verification
_sent_notifications = []


def is_production() -> bool:
    """Return True if running in production."""
    return os.getenv("APP_ENV", "production").lower() == "production"


def is_mock_mode() -> bool:
    """Return True if mock mode is active. Strictly rejected in production."""
    if is_production():
        if os.getenv("PUSH_MOCK_MODE", "false").lower() in ("true", "1"):
            logger.error("Security violation: PUSH_MOCK_MODE is not allowed in production.")
            raise RuntimeError("PUSH_MOCK_MODE is strictly forbidden in production environment.")
        return False
    return os.getenv("PUSH_MOCK_MODE", "false").lower() in ("true", "1") or os.getenv("APP_ENV") == "testing"


def get_sent_notifications():
    """Return in-memory captured notifications for unit test assertions."""
    return list(_sent_notifications)


def clear_sent_notifications():
    """Clear test capture queue."""
    global _sent_notifications
    _sent_notifications = []


def infer_token_type(token: str) -> str:
    """Infer token type from format."""
    if token.startswith(("ExponentPushToken[", "ExpoPushToken[")):
        return "expo"
    return "fcm"


def validate_token(token: str, platform: str) -> tuple[bool, str]:
    """Validate token length and platform identifier."""
    if not token or not isinstance(token, str):
        return False, "Token must be a non-empty string."
    token_clean = token.strip()
    if len(token_clean) < 10 or len(token_clean) > 4096:
        return False, "Token length must be between 10 and 4096 characters."
    allowed_platforms = {"android", "ios", "web", "unknown"}
    if platform and platform.lower() not in allowed_platforms:
        return False, f"Platform must be one of {allowed_platforms}."
    return True, ""


# --- Device Token Management ---

def register_device_token(db_conn, user_id: str, token: str, platform: str = "unknown", token_type: str = None) -> dict:
    """Atomically register or reassign a device token to user_id."""
    valid, err = validate_token(token, platform)
    if not valid:
        return {"ok": False, "error": err, "status_code": 400}

    token_clean = token.strip()
    plat = platform.lower() if platform else "unknown"
    t_type = token_type if token_type in ("expo", "fcm") else infer_token_type(token_clean)

    cur = db_conn.cursor()
    try:
        cur.execute("""
            INSERT INTO push_tokens (user_id, token, token_type, platform, is_active, updated_at)
            VALUES (%s, %s, %s, %s, TRUE, NOW())
            ON CONFLICT (token) DO UPDATE
            SET user_id = EXCLUDED.user_id,
                platform = EXCLUDED.platform,
                token_type = EXCLUDED.token_type,
                is_active = TRUE,
                updated_at = NOW()
        """, (str(user_id), token_clean, t_type, plat))
        db_conn.commit()
        return {"ok": True, "registered": True, "token_type": t_type}
    except Exception as e:
        db_conn.rollback()
        logger.exception("Failed to register push token: %s", e)
        return {"ok": False, "error": str(e), "status_code": 500}
    finally:
        cur.close()


def unregister_device_token(db_conn, user_id: str, token: str) -> dict:
    """Unregister a token strictly owned by user_id."""
    if not token:
        return {"ok": False, "error": "Token is required.", "status_code": 400}

    cur = db_conn.cursor()
    try:
        cur.execute("""
            DELETE FROM push_tokens 
            WHERE token = %s AND user_id = %s
            RETURNING id
        """, (token.strip(), str(user_id)))
        deleted = cur.fetchone()
        db_conn.commit()
        if not deleted:
            return {"ok": True, "unregistered": False, "message": "Token not found for this user."}
        return {"ok": True, "unregistered": True}
    except Exception as e:
        db_conn.rollback()
        logger.exception("Failed to unregister push token: %s", e)
        return {"ok": False, "error": str(e), "status_code": 500}
    finally:
        cur.close()


def prune_stale_token(db_conn, token: str):
    """Prune invalid or expired token from database."""
    cur = db_conn.cursor()
    try:
        cur.execute("DELETE FROM push_tokens WHERE token = %s", (token.strip(),))
        db_conn.commit()
        logger.info("Pruned stale push token: %s...", token[:15])
    except Exception as e:
        db_conn.rollback()
        logger.warning("Failed to prune stale push token: %s", e)
    finally:
        cur.close()


# --- Dispatch Mechanisms ---

def _dispatch_expo_push(tokens: list, title: str, body: str, data: dict = None) -> dict:
    """Dispatch push notifications via Expo Push Service."""
    if not tokens:
        return {"status": "no_tokens"}

    import requests
    access_token = os.getenv("EXPO_ACCESS_TOKEN")
    headers = {"Content-Type": "application/json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    messages = [
        {
            "to": t,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
            "priority": "high"
        }
        for t in tokens
    ]

    try:
        r = requests.post(
            "https://exp.host/--/api/v2/push/send",
            headers=headers,
            data=json.dumps(messages),
            timeout=5
        )
        resp_data = r.json() if r.status_code == 200 else {}
        stale_tokens = []
        if isinstance(resp_data.get("data"), list):
            for i, ticket in enumerate(resp_data["data"]):
                if ticket.get("status") == "error":
                    err_code = ticket.get("details", {}).get("error")
                    if err_code == "DeviceNotRegistered" and i < len(tokens):
                        stale_tokens.append(tokens[i])

        return {
            "status": "delivered_to_provider",
            "provider": "expo",
            "http_status": r.status_code,
            "stale_tokens": stale_tokens
        }
    except Exception as e:
        logger.warning("Expo push network failure: %s", e)
        return {"status": "provider_error", "error": str(e)}


def get_fcm_oauth_token() -> tuple[str, str]:
    """Retrieve Google OAuth 2.0 access token for FCM HTTP v1.
    
    Production Strategy (APP_ENV=production):
    - Prioritizes dynamic Google Application Default Credentials (ADC / Workload Identity) first,
      ensuring short-lived tokens are automatically refreshed without risking static token expiration.
    - Falls back to FCM_OAUTH2_ACCESS_TOKEN if ADC is unconfigured or if FCM_USE_STATIC_TOKEN=true.
    
    Development/Testing Strategy (APP_ENV != 'production'):
    - Checks FCM_OAUTH2_ACCESS_TOKEN first for deterministic mock injection and CI/CD testing.
    - Falls back to dynamic ADC if FCM_OAUTH2_ACCESS_TOKEN is not set.
    """
    is_prod = is_production()
    force_static = os.getenv("FCM_USE_STATIC_TOKEN", "false").lower() in ("true", "1")

    def _try_adc():
        try:
            import google.auth
            from google.auth.transport.requests import Request
            creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/firebase.messaging"])
            creds.refresh(Request())
            if creds.token:
                return creds.token, "google_auth_adc"
        except Exception:
            pass
        return None

    # In production, prioritize dynamic ADC to ensure short-lived tokens are refreshed
    if is_prod and not force_static:
        adc_res = _try_adc()
        if adc_res:
            return adc_res

    # Check static token (development, testing, or production fallback)
    token = (os.getenv("FCM_OAUTH2_ACCESS_TOKEN") or "").strip()
    if token:
        return token, "static_env"

    # Fallback to ADC if not yet attempted
    if not is_prod or force_static:
        adc_res = _try_adc()
        if adc_res:
            return adc_res

    return "", ""


def _dispatch_fcm_push(tokens: list, title: str, body: str, data: dict = None) -> dict:
    """Dispatch push notifications via Firebase Cloud Messaging HTTP v1 API.
    
    Authentication Requirements:
    - FCM HTTP v1 requires Google OAuth 2.0 Bearer token authentication.
    - Legacy server keys (FIREBASE_SERVER_KEY) are deprecated by Google and cannot authenticate against HTTP v1.
    - Required configuration:
        FCM_PROJECT_ID (or FIREBASE_PROJECT_ID): Google Cloud / Firebase project ID
        FCM_OAUTH2_ACCESS_TOKEN or Google Application Default Credentials (ADC / Service Account).
    """
    project_id = (os.getenv("FCM_PROJECT_ID") or os.getenv("FIREBASE_PROJECT_ID") or "").strip()
    oauth_token, token_source = get_fcm_oauth_token()

    # Guard: Detect accidental use of legacy server key
    if not oauth_token and (os.getenv("FIREBASE_SERVER_KEY") or os.getenv("FCM_SERVER_KEY")):
        logger.error(
            "Legacy FCM server key detected. FCM HTTP v1 requires Google OAuth 2.0 Bearer token "
            "(FCM_OAUTH2_ACCESS_TOKEN or google-auth ADC), not legacy server key."
        )
        return {"status": "provider_misconfigured", "error": "FCM HTTP v1 requires OAuth 2.0 access token."}

    if not project_id or not oauth_token:
        if is_production():
            logger.error("CRITICAL: FCM HTTP v1 credentials (FCM_PROJECT_ID / OAuth token) missing in production.")
        return {"status": "provider_unconfigured"}

    import requests
    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {oauth_token}"
    }

    stale_tokens = []
    success_count = 0

    # FCM HTTP v1 data payload requires all string key-value pairs
    stringified_data = {str(k): str(v) for k, v in (data or {}).items()}

    for token in tokens:
        payload = {
            "message": {
                "token": token,
                "notification": {
                    "title": title,
                    "body": body
                },
                "data": stringified_data
            }
        }
        try:
            r = requests.post(url, headers=headers, data=json.dumps(payload), timeout=5)
            if r.status_code == 200:
                success_count += 1
            elif r.status_code in (400, 404):
                try:
                    resp_json = r.json()
                    err_status = resp_json.get("error", {}).get("status", "")
                    if err_status in ("UNREGISTERED", "NOT_FOUND", "INVALID_ARGUMENT"):
                        stale_tokens.append(token)
                except Exception:
                    stale_tokens.append(token)
            elif r.status_code in (401, 403):
                logger.error("FCM HTTP v1 authentication failed (HTTP %d). Check OAuth token/permissions.", r.status_code)
        except Exception as e:
            logger.warning("FCM HTTP v1 network failure for token %s...: %s", token[:15], e)

    return {
        "status": "delivered_to_provider" if success_count > 0 else "provider_error",
        "provider": "fcm_v1",
        "success_count": success_count,
        "stale_tokens": stale_tokens
    }


# --- Core Notification Dispatcher ---

def create_and_dispatch_notification(
    get_db_conn_fn,
    user_id: str,
    title: str,
    body: str,
    notification_type: str,
    related_id: str = None,
    idempotency_key: str = None,
    data: dict = None,
    expected_claim_timestamp = None
) -> dict:
    """Create in-app notification with atomic deduplication and dispatch push.
    
    Delivery Guarantee:
    - At-least-once dispatch with multi-layer duplicate mitigation (unique idempotency_keys,
      lease timestamp fencing, and FOR UPDATE SKIP LOCKED queues).
    - Remote push networks (APNs/FCM) cannot guarantee exactly-once delivery across external
      network boundaries; database state transitions prevent internal duplicates and stale worker overwrites.
    - In production, missing credentials or mock mode fail safely.
    """
    conn = get_db_conn_fn()
    if not conn:
        return {"ok": False, "error": "Database unavailable", "status": "db_error"}

    notification_id = None
    already_sent = False

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # 1. Atomic insertion with unique idempotency_key
        cur.execute("""
            INSERT INTO notifications (
                user_id, title, body, type, related_id, idempotency_key, push_status, push_attempts
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'pending', 0)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id
        """, (str(user_id), title, body, notification_type, str(related_id) if related_id else None, idempotency_key))
        row = cur.fetchone()

        if row:
            notification_id = str(row['id'])
            conn.commit()
        else:
            # Duplicate event detected. Check if push is already sent or still pending.
            if idempotency_key:
                cur.execute("""
                    SELECT id, push_status, push_attempts 
                    FROM notifications 
                    WHERE idempotency_key = %s
                """, (idempotency_key,))
                existing = cur.fetchone()
                if existing:
                    notification_id = str(existing['id'])
                    if existing['push_status'] in ('sent', 'mocked', 'permanently_failed', 'skipped_no_tokens', 'legacy'):
                        already_sent = True
                    # If push_status is 'pending', 'processing', or 'failed' with attempts < 3, allow dispatch/retry
            conn.commit()

        if already_sent:
            return {
                "ok": True,
                "notification_id": notification_id,
                "in_app_saved": True,
                "duplicate": True,
                "pushed": False,
                "status": "duplicate_suppressed"
            }

        # 2. Query active tokens for recipient
        cur.execute("""
            SELECT token, token_type 
            FROM push_tokens 
            WHERE user_id = %s AND is_active = TRUE
        """, (str(user_id),))
        tokens = cur.fetchall()

        if not tokens:
            if notification_id:
                with _in_flight_lock:
                    effective_claim_timestamp = _in_flight_claimed_times.get(str(notification_id), expected_claim_timestamp)
                if effective_claim_timestamp is not None:
                    cur.execute("""
                        UPDATE notifications 
                        SET push_status = 'skipped_no_tokens', push_attempts = 1, updated_at = NOW() 
                        WHERE id = %s AND updated_at = %s
                    """, (notification_id, effective_claim_timestamp))
                else:
                    cur.execute("""
                        UPDATE notifications 
                        SET push_status = 'skipped_no_tokens', push_attempts = 1, updated_at = NOW() 
                        WHERE id = %s
                    """, (notification_id,))
                conn.commit()
            return {
                "ok": True,
                "notification_id": notification_id,
                "in_app_saved": True,
                "pushed": False,
                "status": "skipped_no_tokens"
            }

        # 3. Handle Mock Mode (Dev/Testing only)
        if is_mock_mode():
            _sent_notifications.append({
                "notification_id": notification_id,
                "user_id": str(user_id),
                "title": title,
                "body": body,
                "type": notification_type,
                "tokens": [t['token'] for t in tokens],
                "data": data or {},
                "idempotency_key": idempotency_key,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            if notification_id:
                with _in_flight_lock:
                    effective_claim_timestamp = _in_flight_claimed_times.get(str(notification_id), expected_claim_timestamp)
                if effective_claim_timestamp is not None:
                    cur.execute("""
                        UPDATE notifications 
                        SET push_status = 'mocked', push_attempts = 1, pushed_at = NOW(), updated_at = NOW() 
                        WHERE id = %s AND updated_at = %s
                    """, (notification_id, effective_claim_timestamp))
                else:
                    cur.execute("""
                        UPDATE notifications 
                        SET push_status = 'mocked', push_attempts = 1, pushed_at = NOW(), updated_at = NOW() 
                        WHERE id = %s
                    """, (notification_id,))
                conn.commit()
            return {
                "ok": True,
                "notification_id": notification_id,
                "in_app_saved": True,
                "mocked": True,
                "pushed": False,
                "status": "mocked"
            }

        # 4. Live Provider Dispatch (Partition by token_type)
        expo_tokens = [t['token'] for t in tokens if t['token_type'] == 'expo' or infer_token_type(t['token']) == 'expo']
        fcm_tokens = [t['token'] for t in tokens if t['token'] not in expo_tokens]

        stale_to_prune = []
        any_success = False

        if expo_tokens:
            res_expo = _dispatch_expo_push(expo_tokens, title, body, data)
            if res_expo.get("status") == "delivered_to_provider":
                any_success = True
            stale_to_prune.extend(res_expo.get("stale_tokens", []))

        if fcm_tokens:
            res_fcm = _dispatch_fcm_push(fcm_tokens, title, body, data)
            if res_fcm.get("status") == "delivered_to_provider":
                any_success = True
            stale_to_prune.extend(res_fcm.get("stale_tokens", []))

        # Prune stale tokens returned by providers
        for stale in stale_to_prune:
            prune_stale_token(conn, stale)

        # Update push delivery status in database with conditional state transition protection
        stale_update_suppressed = False
        if notification_id:
            with _in_flight_lock:
                effective_claim_timestamp = _in_flight_claimed_times.get(str(notification_id), expected_claim_timestamp)

            if effective_claim_timestamp is not None:
                cur.execute("""
                    UPDATE notifications 
                    SET push_status = CASE 
                            WHEN %s = TRUE THEN 'sent'
                            WHEN push_attempts + 1 >= 3 THEN 'permanently_failed'
                            ELSE 'failed'
                        END,
                        push_attempts = push_attempts + 1, 
                        pushed_at = CASE WHEN %s = TRUE THEN NOW() ELSE pushed_at END,
                        updated_at = NOW()
                    WHERE id = %s
                      AND updated_at = %s
                      AND (
                          -- Successful sends can transition if not already sent
                          (%s = TRUE AND push_status != 'sent')
                          OR
                          -- Failed attempts can only update if still in processing or pending
                          -- NEVER overwrite a record already marked 'sent' by a concurrent worker
                          (%s = FALSE AND push_status IN ('processing', 'pending'))
                      )
                """, (any_success, any_success, notification_id, effective_claim_timestamp, any_success, any_success))
            else:
                cur.execute("""
                    UPDATE notifications 
                    SET push_status = CASE 
                            WHEN %s = TRUE THEN 'sent'
                            WHEN push_attempts + 1 >= 3 THEN 'permanently_failed'
                            ELSE 'failed'
                        END,
                        push_attempts = push_attempts + 1, 
                        pushed_at = CASE WHEN %s = TRUE THEN NOW() ELSE pushed_at END,
                        updated_at = NOW()
                    WHERE id = %s
                      AND (
                          -- Successful sends can transition if not already sent
                          (%s = TRUE AND push_status != 'sent')
                          OR
                          -- Failed attempts can only update if still in processing or pending
                          -- NEVER overwrite a record already marked 'sent' by a concurrent worker
                          (%s = FALSE AND push_status IN ('processing', 'pending'))
                      )
                """, (any_success, any_success, notification_id, any_success, any_success))
            rows_updated = cur.rowcount
            conn.commit()
            if effective_claim_timestamp is not None and rows_updated == 0:
                stale_update_suppressed = True
                logger.warning(
                    "Notification %s update suppressed: claim timestamp mismatch or record reclaimed by newer worker.",
                    notification_id
                )

        return {
            "ok": True,
            "notification_id": notification_id,
            "in_app_saved": True,
            "pushed": any_success,
            "status": "sent" if any_success else "failed",
            "stale_update_suppressed": stale_update_suppressed
        }

    except Exception as e:
        logger.exception("Error in create_and_dispatch_notification: %s", e)
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return {"ok": False, "error": str(e), "in_app_saved": False, "pushed": False}
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        conn.close()


_recovery_worker_thread = None
_recovery_worker_stop = threading.Event()
_in_flight_notification_ids = set()
_in_flight_claimed_times = {}
_in_flight_lock = threading.Lock()


def refresh_notification_lease(get_db_conn_fn, notification_id: str, expected_claim_timestamp=None) -> dict:
    """Refresh the processing lease timestamp (updated_at = NOW()) for an active notification.
    
    Guarantees:
    - Active worker can renew its 5-minute exclusive lease during extended operations.
    - Requires caller's expected_claim_timestamp (or retrieves it from worker-owned in-flight tracking).
    - If another worker has reclaimed the record, updated_at does not match, the query affects 0 rows,
      and refresh returns ok: False, renewed: False.
    - Synchronizes _in_flight_claimed_times in-memory cache to maintain distributed fencing.
    """
    if not notification_id:
        return {"ok": False, "error": "notification_id required"}
    conn = get_db_conn_fn()
    if not conn:
        return {"ok": False, "error": "Database unavailable"}

    nid_str = str(notification_id)
    if expected_claim_timestamp is None:
        with _in_flight_lock:
            expected_claim_timestamp = _in_flight_claimed_times.get(nid_str)

    if expected_claim_timestamp is None:
        return {
            "ok": False,
            "renewed": False,
            "error": "Cannot refresh lease: caller holds no registered ownership token or claim timestamp."
        }

    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE notifications
            SET updated_at = NOW()
            WHERE id = %s AND push_status = 'processing' AND updated_at = %s
            RETURNING updated_at;
        """, (nid_str, expected_claim_timestamp))
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        if not row:
            # Lease expired or reclaimed by another worker - clear local tracking
            with _in_flight_lock:
                _in_flight_notification_ids.discard(nid_str)
                _in_flight_claimed_times.pop(nid_str, None)
            return {"ok": False, "renewed": False, "message": "Lease not found, expired, or reclaimed by another worker."}

        renewed_at = row[0]
        with _in_flight_lock:
            _in_flight_claimed_times[nid_str] = renewed_at
            _in_flight_notification_ids.add(nid_str)
        return {"ok": True, "renewed": True, "updated_at": renewed_at}
    except Exception as e:
        logger.warning("Failed to refresh notification lease for %s: %s", notification_id, e)
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        return {"ok": False, "error": str(e)}


def process_pending_pushes(get_db_conn_fn, limit: int = 50) -> int:
    """Recovery worker: Retry pending or failed push notifications after crashes/outages.
    
    Guarantees:
    - Retries both 'pending' (older than 10s grace period) and 'failed' notifications with push_attempts < 3.
    - Uses FOR UPDATE SKIP LOCKED to prevent concurrent workers from claiming the same notification.
    - Transitions claimed rows atomically to 'processing' and establishes a fresh updated_at = NOW() lease.
    - Excludes legacy rows where idempotency_key IS NULL.
    - Tracks worker-owned IDs and exact claim timestamps in _in_flight_notification_ids and _in_flight_claimed_times.
    - Passes exact claim timestamp to create_and_dispatch_notification for distributed lease fencing.
    - Marks exhausted retries (>= 3) as 'permanently_failed'.
    """
    conn = get_db_conn_fn()
    if not conn:
        return 0

    recovered = 0
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Atomically select and transition eligible notifications using FOR UPDATE SKIP LOCKED
        cur.execute("""
            UPDATE notifications
            SET push_status = 'processing', updated_at = NOW()
            WHERE id IN (
                SELECT id FROM notifications
                WHERE ((push_status = 'failed' OR (push_status = 'pending' AND created_at < NOW() - INTERVAL '10 seconds'))
                       AND idempotency_key IS NOT NULL AND push_attempts < 3
                       AND created_at >= NOW() - INTERVAL '2 hours')
                   OR (push_status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes')
                ORDER BY created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT %s
            )
            RETURNING id, user_id, title, body, type, related_id, idempotency_key, push_attempts, updated_at;
        """, (limit,))
        items = cur.fetchall()
        conn.commit()
        cur.close()
        conn.close()

        batch_ids = [str(item['id']) for item in items]
        batch_times = {str(item['id']): item.get('updated_at') for item in items if item.get('updated_at')}
        with _in_flight_lock:
            _in_flight_notification_ids.update(batch_ids)
            _in_flight_claimed_times.update(batch_times)

        for item in items:
            item_id = str(item['id'])
            claimed_at = item.get('updated_at')
            try:
                res = create_and_dispatch_notification(
                    get_db_conn_fn=get_db_conn_fn,
                    user_id=item['user_id'],
                    title=item['title'],
                    body=item['body'],
                    notification_type=item['type'],
                    related_id=item['related_id'],
                    idempotency_key=item['idempotency_key'],
                    expected_claim_timestamp=claimed_at
                )
                if res.get("pushed") or res.get("mocked"):
                    recovered += 1
            finally:
                with _in_flight_lock:
                    _in_flight_notification_ids.discard(item_id)
                    _in_flight_claimed_times.pop(item_id, None)

        return recovered
    except Exception as e:
        logger.exception("Failed in process_pending_pushes: %s", e)
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        return 0


def get_in_flight_notification_ids() -> list:
    """Return a snapshot of notification IDs currently being processed by this worker."""
    with _in_flight_lock:
        return list(_in_flight_notification_ids)


def run_recovery_loop(get_db_conn_fn, interval_seconds: int = 60, stop_event: threading.Event = None):
    """Periodic loop executing process_pending_pushes."""
    logger.info("Starting background push recovery worker loop (interval: %ds)", interval_seconds)
    while stop_event is None or not stop_event.is_set():
        try:
            recovered = process_pending_pushes(get_db_conn_fn)
            if recovered > 0:
                logger.info("Push recovery worker recovered %d pending notifications", recovered)
        except Exception as e:
            logger.error("Error in push recovery worker iteration: %s", e)
        
        if stop_event:
            stop_event.wait(interval_seconds)
        else:
            time.sleep(interval_seconds)


def start_background_recovery_worker(get_db_conn_fn, interval_seconds: int = 60):
    """Start background daemon thread for recovering pending pushes during normal server operation."""
    global _recovery_worker_thread, _recovery_worker_stop
    if _recovery_worker_thread and _recovery_worker_thread.is_alive():
        return _recovery_worker_thread

    _recovery_worker_stop.clear()
    _recovery_worker_thread = threading.Thread(
        target=run_recovery_loop,
        args=(get_db_conn_fn, interval_seconds, _recovery_worker_stop),
        daemon=True,
        name="PushRecoveryWorker"
    )
    _recovery_worker_thread.start()
    logger.info("Background push recovery worker started.")
    return _recovery_worker_thread


def reset_stuck_processing_pushes(
    get_db_conn_fn,
    notification_ids: list = None,
    id_timestamps: dict = None,
    stale_after_seconds: int = 300
) -> int:
    """Reset notifications in 'processing' status back to 'pending'.
    
    Concurrency Safeguards:
    - If id_timestamps is provided: resets ONLY rows matching both the ID AND the exact claim timestamp
      held by this worker. If another worker reclaimed the row in the interim, updated_at was bumped
      and this update will match 0 rows, completely protecting the newer worker.
    - If notification_ids is provided: resets ONLY those specific IDs owned by this worker.
      Other concurrent workers' notifications are completely untouched.
    - If neither is provided: resets ONLY abandoned records where
      updated_at < NOW() - (stale_after_seconds * INTERVAL '1 second') (default: 300s / 5 mins).
      NEVER performs an un-scoped global reset that could disrupt other active workers.
    """
    conn = get_db_conn_fn()
    if not conn:
        return 0
    try:
        cur = conn.cursor()
        count = 0
        if id_timestamps:
            for nid, claimed_at in id_timestamps.items():
                if claimed_at:
                    cur.execute("""
                        UPDATE notifications
                        SET push_status = 'pending', updated_at = NOW()
                        WHERE id = %s AND push_status = 'processing' AND updated_at = %s;
                    """, (nid, claimed_at))
                else:
                    cur.execute("""
                        UPDATE notifications
                        SET push_status = 'pending', updated_at = NOW()
                        WHERE id = %s AND push_status = 'processing';
                    """, (nid,))
                count += cur.rowcount
        elif notification_ids:
            cur.execute("""
                UPDATE notifications
                SET push_status = 'pending', updated_at = NOW()
                WHERE id = ANY(%s::uuid[]) AND push_status = 'processing';
            """, (list(notification_ids),))
            count = cur.rowcount
        else:
            cur.execute("""
                UPDATE notifications
                SET push_status = 'pending', updated_at = NOW()
                WHERE push_status = 'processing' AND updated_at < NOW() - (%s * INTERVAL '1 second');
            """, (max(stale_after_seconds, 60),))
            count = cur.rowcount

        conn.commit()
        cur.close()
        conn.close()
        return count
    except Exception as e:
        if "push_status" in str(e) or "does not exist" in str(e):
            logger.debug("notifications table/column not present yet; skipping reset.")
        else:
            logger.warning("Failed to reset stuck processing pushes: %s", e)
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        return 0


def stop_background_recovery_worker(get_db_conn_fn=None):
    """Stop background recovery worker thread cleanly and reset only in-flight records owned by this worker."""
    global _recovery_worker_thread, _recovery_worker_stop
    if _recovery_worker_stop:
        _recovery_worker_stop.set()
    if _recovery_worker_thread and _recovery_worker_thread.is_alive():
        _recovery_worker_thread.join(timeout=2)
    _recovery_worker_thread = None

    # Reset ONLY the specific in-flight notification IDs and claim timestamps owned by this worker process
    if get_db_conn_fn:
        with _in_flight_lock:
            orphaned_times = dict(_in_flight_claimed_times)
            orphaned_ids = list(_in_flight_notification_ids)
        if orphaned_ids:
            try:
                reset_stuck_processing_pushes(
                    get_db_conn_fn,
                    notification_ids=orphaned_ids,
                    id_timestamps=orphaned_times
                )
                with _in_flight_lock:
                    _in_flight_notification_ids.difference_update(orphaned_ids)
                    for nid in orphaned_ids:
                        _in_flight_claimed_times.pop(nid, None)
            except Exception:
                pass


if __name__ == '__main__':
    import sys
    from app import get_db_connection
    if '--once' in sys.argv:
        count = process_pending_pushes(get_db_connection)
        print(f"Processed pending pushes. Recovered: {count}")
    else:
        print("Running push recovery worker daemon. Press Ctrl+C to stop.")
        try:
            run_recovery_loop(get_db_connection, interval_seconds=30)
        except KeyboardInterrupt:
            print("Push recovery worker stopped.")

