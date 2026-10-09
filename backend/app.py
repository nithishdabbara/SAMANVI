import os
import datetime
import time
import jwt
import json
import math
import uuid
import requests
from flask import Flask, jsonify, request
from functools import wraps
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from cryptography.fernet import Fernet
from marshmallow import Schema, fields, validate

# Load environment variables
load_dotenv()

from extensions import limiter
import otp_service
from otp_service import OtpError

_WEAK_SECRETS = {"super-secret-key-for-samanvi", "secret", "changeme", "change-me", "your-secret-key", "password"}


def _require_secret(name, min_len=32):
    """Read a mandatory secret from the environment and refuse to start without a strong one."""
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"{name} is not set. Refusing to start: copy .env.example to .env and generate a value "
            f"(e.g. python -c \"import secrets; print(secrets.token_urlsafe(48))\")."
        )
    if value.lower() in _WEAK_SECRETS or len(value) < min_len:
        raise RuntimeError(f"{name} is too weak (needs at least {min_len} characters and must not be a placeholder).")
    return value


import config_validator

# Perform non-sensitive configuration validation
if os.getenv("APP_ENV") != "testing":
    _cfg_ok, _cfg_errors = config_validator.validate_config()
    if not _cfg_ok:
        if config_validator.is_production():
            raise RuntimeError("Production startup refused due to configuration errors: " + " | ".join(_cfg_errors))
        else:
            for _err in _cfg_errors:
                print(f"[Config Warning] {_err}")

JWT_SECRET_KEY = _require_secret("JWT_SECRET_KEY")
MESSAGE_ENCRYPTION_KEY = _require_secret("MESSAGE_ENCRYPTION_KEY", min_len=40)
JWT_ACCESS_TOKEN_DAYS = int(os.getenv("JWT_ACCESS_TOKEN_DAYS", "7"))

app = Flask(__name__, static_folder='static')
# Mobile clients authenticate with a bearer token (no cookies), so credentials are not enabled.
# Restrict CORS_ALLOWED_ORIGINS (comma separated) when serving a web build.
_cors_origins = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",") if o.strip()]
CORS(app, resources={r"/api/*": {"origins": _cors_origins}})
bcrypt = Bcrypt(app)
app.config['SECRET_KEY'] = JWT_SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv("MAX_UPLOAD_MB", "8")) * 1024 * 1024
limiter.init_app(app)

# Behind a reverse proxy / tunnel set TRUSTED_PROXY_COUNT so rate limits see the real client IP.
_proxies = int(os.getenv("TRUSTED_PROXY_COUNT", "0"))
if _proxies:
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=_proxies, x_proto=_proxies, x_host=_proxies)

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": f"Rate limit exceeded: {e.description}", "code": "rate_limited"}), 429

@app.errorhandler(OtpError)
def otp_error_handler(e):
    body, status = e.to_response()
    return jsonify(body), status

@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    if request.is_secure or request.headers.get('X-Forwarded-Proto') == 'https':
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

UPLOAD_FOLDER = 'static/uploads/avatars'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Folder for problem photos
PROBLEM_UPLOAD_FOLDER = 'static/uploads/problems'
if not os.path.exists(PROBLEM_UPLOAD_FOLDER):
    os.makedirs(PROBLEM_UPLOAD_FOLDER)

try:
    import cloudinary
    import cloudinary.uploader
    HAS_CLOUDINARY = True
except ImportError:
    HAS_CLOUDINARY = False

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def upload_to_cloudinary_or_local(file, folder="problems", filename_prefix="img"):
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")
    
    if HAS_CLOUDINARY and cloud_name and api_key and api_secret:
        try:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True
            )
            file.seek(0)
            res = cloudinary.uploader.upload(file, folder=f"samanvi/{folder}")
            if res and "secure_url" in res:
                print(f"[Cloudinary CDN Success] Uploaded cloud image: {res['secure_url']}")
                return res["secure_url"]
        except Exception as e:
            print(f"[Cloudinary Warning] Upload failed: {e}. Falling back to local storage.")

    # Local disk fallback
    extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
    filename = f"{filename_prefix}_{int(time.time())}_{uuid.uuid4().hex[:6]}.{extension}"
    target_folder = PROBLEM_UPLOAD_FOLDER if folder == "problems" else app.config['UPLOAD_FOLDER']
    os.makedirs(target_folder, exist_ok=True)
    filepath = os.path.join(target_folder, filename)
    file.seek(0)
    file.save(filepath)
    sub_path = "problems" if folder == "problems" else "avatars"
    return f"{request.host_url}static/uploads/{sub_path}/{filename}"

# Database Connection Pool Setup
def get_db_connection():
    try:
        conn = psycopg2.connect(
            os.getenv('DATABASE_URL'),
            sslmode=os.getenv('DB_SSLMODE', 'require')
        )
        return conn
    except Exception as e:
        print(f"Error connecting to the database: {e}")
        return None

def seed_categories():
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories';")
        if not cur.fetchone():
            cur.close()
            conn.close()
            return
        categories = [
            "Electricity",
            "Water",
            "Road",
            "Safety",
            "Sanitation",
            "Home Repairs & Plumbing",
            "Tutoring & Tech Help",
            "Borrowing Tools",
            "Errands & Moving",
            "Community Event"
        ]
        for cat in categories:
            cur.execute("INSERT INTO categories (name) VALUES (%s) ON CONFLICT (name) DO NOTHING", (cat,))
        conn.commit()
        cur.close()
        conn.close()
        print("Categories seeded successfully.")
    except Exception as e:
        print(f"Error seeding categories: {e}")
        if conn:
            conn.rollback()
            conn.close()

seed_categories()

@app.route('/health', methods=['GET'])
@app.route('/api/health/live', methods=['GET'])
def liveness_check():
    """Liveness probe: verifies process is alive and responsive without touching dependencies."""
    return jsonify({
        "status": "healthy",
        "service": "samanvi-api"
    }), 200


@app.route('/ready', methods=['GET'])
@app.route('/api/ready', methods=['GET'])
@app.route('/api/health/ready', methods=['GET'])
def readiness_check():
    """Readiness probe: verifies dependencies required to serve requests (database connectivity).
    Returns HTTP 200 when ready, HTTP 503 when database is unavailable.
    Never exposes internal database credentials, connection strings, or stack traces.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({
            "status": "not_ready",
            "service": "samanvi-api",
            "database": "unavailable"
        }), 503
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1;")
        cur.fetchone()
        cur.close()
        conn.close()
        return jsonify({
            "status": "ready",
            "service": "samanvi-api",
            "database": "connected"
        }), 200
    except Exception as e:
        app.logger.warning("Readiness probe check failed: %s", type(e).__name__)
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({
            "status": "not_ready",
            "service": "samanvi-api",
            "database": "unavailable"
        }), 503


@app.route('/api/health', methods=['GET'])
def health_check():
    """Backwards-compatible health check endpoint."""
    conn = get_db_connection()
    if conn:
        try:
            conn.close()
        except Exception:
            pass
        return jsonify({"status": "healthy", "message": "Samanvi Python Flask API is running!"}), 200
    else:
        return jsonify({"status": "unhealthy", "message": "API is running, but database connection failed."}), 500




# --- Encryption & Decryption ---
from cryptography.fernet import MultiFernet
try:
    _fernets = [Fernet(MESSAGE_ENCRYPTION_KEY.encode())]
    # Optionally keep decrypting messages written with retired keys (comma separated).
    _fernets += [Fernet(k.strip().encode()) for k in os.getenv("MESSAGE_ENCRYPTION_KEYS_PREVIOUS", "").split(",") if k.strip()]
except ValueError:
    raise RuntimeError("MESSAGE_ENCRYPTION_KEY is not a valid Fernet key. Generate one with "
                       "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
cipher = MultiFernet(_fernets)

def encrypt_message(text):
    if not text:
        return ""
    return cipher.encrypt(text.encode()).decode()

def decrypt_message(encrypted):
    if not encrypted:
        return ""
    if not encrypted.startswith('gAAAAAB'):
        return encrypted
    try:
        return cipher.decrypt(encrypted.encode()).decode()
    except Exception:
        import logging
        logging.error("Failed to decrypt a message token.")
        return "[Message unavailable]"

# --- Haversine Distance Calculation ---
def haversine_distance_km(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two GPS points in kilometers.
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 0.0
    R = 6371  # Earth radius in km
    
    lat1_r = math.radians(float(lat1))
    lat2_r = math.radians(float(lat2))
    
    delta_lat = math.radians(float(lat2) - float(lat1))
    delta_lon = math.radians(float(lon2) - float(lon1))
    
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_r) * math.cos(lat2_r) *
         math.sin(delta_lon / 2) ** 2)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def is_within_community(user_home_lat, user_home_lon, point_lat, point_lon, radius_km=1):
    distance = haversine_distance_km(user_home_lat, user_home_lon, point_lat, point_lon)
    return distance <= radius_km, round(distance, 2)

# --- Location Privacy Offset ---
def add_location_offset(lat, lon, max_meters=100):
    if lat is None or lon is None:
        return lat, lon
    import random
    earth_radius = 6371000
    angle = random.uniform(0, 2 * math.pi)
    distance = random.uniform(50, max_meters)
    delta_lat = (distance * math.cos(angle)) / earth_radius
    delta_lon = (distance * math.sin(angle)) / (
        earth_radius * math.cos(math.radians(float(lat)))
    )
    return (
        float(lat) + math.degrees(delta_lat),
        float(lon) + math.degrees(delta_lon)
    )

# --- Reverse Geocoding with Fallback ---
VADODARA_LOCALITIES = [
    {
        "name": "Alkapuri",
        "center_lat": 22.3107,
        "center_lon": 73.1839,
        "radius_km": 2.0
    },
    {
        "name": "Sayajigunj",
        "center_lat": 22.3168,
        "center_lon": 73.1826,
        "radius_km": 1.5
    },
    {
        "name": "Fatehgunj",
        "center_lat": 22.3269,
        "center_lon": 73.1888,
        "radius_km": 2.0
    },
    {
        "name": "Waghodia",
        "center_lat": 22.3058,
        "center_lon": 73.3742,
        "radius_km": 5.0
    },
    {
        "name": "Gotri",
        "center_lat": 22.3390,
        "center_lon": 73.1461,
        "radius_km": 2.5
    },
    {
        "name": "Manjalpur",
        "center_lat": 22.2678,
        "center_lon": 73.1759,
        "radius_km": 2.5
    },
    {
        "name": "Karelibaug",
        "center_lat": 22.3256,
        "center_lon": 73.2089,
        "radius_km": 2.0
    },
    {
        "name": "Vadodara City",
        "center_lat": 22.3072,
        "center_lon": 73.1812,
        "radius_km": 20.0  # Catchall
    }
]

def fallback_geocode(lat, lon):
    closest = None
    closest_distance = float('inf')
    
    for locality in VADODARA_LOCALITIES:
        distance = haversine_distance_km(
            lat, lon,
            locality['center_lat'],
            locality['center_lon']
        )
        if distance < closest_distance:
            closest_distance = distance
            closest = locality['name']
    
    return closest or "Vadodara"

def reverse_geocode(lat, lon):
    google_key = os.environ.get('GOOGLE_MAPS_KEY')
    if google_key:
        try:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                "latlng": f"{lat},{lon}",
                "key": google_key
            }
            response = requests.get(url, params=params, timeout=5)
            data = response.json()
            
            if data.get('status') == 'OK' and data['results']:
                components = data['results'][0]['address_components']
                for component in components:
                    types = component.get('types', [])
                    if 'sublocality_level_1' in types or \
                       'sublocality' in types or \
                       'neighborhood' in types:
                        return component['long_name']
                for component in components:
                    if 'locality' in component.get('types', []):
                        return component['long_name']
        except Exception as e:
            print(f"Google geocoding failed: {e}")
    
    return fallback_geocode(lat, lon)

# --- Validation Schemas ---
class CreateProblemSchema(Schema):
    title = fields.Str(
        required=True,
        validate=validate.Length(min=5, max=200)
    )
    description = fields.Str(
        required=True,
        validate=validate.Length(min=10, max=2000)
    )
    lat = fields.Float(required=False, allow_none=True)
    lon = fields.Float(required=False, allow_none=True)
    latitude = fields.Float(required=False, allow_none=True)
    longitude = fields.Float(required=False, allow_none=True)
    cat_id = fields.Str(required=False, allow_none=True)
    category_id = fields.Str(required=False, allow_none=True)
    category = fields.Str(required=False, allow_none=True)
    priority = fields.Str(
        required=False,
        validate=validate.OneOf(['critical', 'high', 'medium', 'low'])
    )
    post_type = fields.Str(
        required=False,
        load_default='free_help',
        validate=validate.OneOf([
            'free_help', 'referral',
            'paid_help', 'skill_exchange'
        ])
    )
    budget_range = fields.Str(
        required=False,
        allow_none=True,
        validate=validate.Length(max=50)
    )

class RegisterSchema(Schema):
    name = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=100)
    )
    email = fields.Email(required=True)
    password = fields.Str(
        required=True,
        validate=validate.Length(min=6)
    )
    role_id = fields.Int(
        required=False,
        load_default=1,
        validate=validate.OneOf([1, 2])
    )
    home_lat = fields.Float(required=False, allow_none=True)
    home_lon = fields.Float(required=False, allow_none=True)
    latitude = fields.Float(required=False, allow_none=True)
    longitude = fields.Float(required=False, allow_none=True)
    phone = fields.Str(required=False, allow_none=True)
    location = fields.Str(required=False, allow_none=True)
    skills = fields.List(fields.Str(), required=False)

# --- Authentication ---
def create_access_token(user_id):
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({
        'typ': 'access',
        'user_id': str(user_id),
        'jti': str(uuid.uuid4()),
        'iat': now.timestamp(),  # sub-second precision so password-change revocation is exact
        'exp': now + datetime.timedelta(days=JWT_ACCESS_TOKEN_DAYS),
    }, JWT_SECRET_KEY, algorithm='HS256')


def decode_access_token(token):
    """Return the verified payload of an access token or raise jwt.PyJWTError."""
    payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'],
                         options={'require': ['exp', 'iat', 'user_id', 'jti']})
    if payload.get('typ') != 'access':
        raise jwt.InvalidTokenError('wrong token type')
    return payload


def _bearer_token():
    parts = request.headers.get('Authorization', '').split()
    return parts[1] if len(parts) == 2 and parts[0] == 'Bearer' else None


def _auth_error(code, message, status=401):
    return jsonify({'message': message, 'error': message, 'code': code}), status


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _bearer_token()
        if not token:
            return _auth_error('token_missing', 'Authentication required')
        try:
            data = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            return _auth_error('token_expired', 'Session expired. Please log in again.')
        except jwt.PyJWTError:
            return _auth_error('token_invalid', 'Invalid authentication token')

        # Server-side checks: fail CLOSED if the database cannot be reached.
        conn = get_db_connection()
        if not conn:
            return _auth_error('auth_unavailable', 'Service temporarily unavailable', 503)
        try:
            cur = conn.cursor()
            cur.execute(
                """SELECT u.is_active, COALESCE(u.account_deleted, FALSE), u.password_changed_at,
                          EXISTS (SELECT 1 FROM token_blacklist b WHERE b.jti = %s)
                   FROM users u WHERE u.id = %s""",
                (data['jti'], data['user_id']),
            )
            row = cur.fetchone()
            cur.close()
        except Exception:
            return _auth_error('auth_unavailable', 'Service temporarily unavailable', 503)
        finally:
            conn.close()
        if not row:
            print('ROW IS NONE')
            return _auth_error('token_invalid', 'Invalid authentication token')
        is_active, deleted, changed_at, blacklisted = row
        if blacklisted:
            return _auth_error('token_revoked', 'Session was signed out. Please log in again.')
        if not is_active or deleted:
            return _auth_error('account_disabled', 'This account is not active')
        if changed_at is not None:
            if float(data['iat']) < changed_at.timestamp():
                return _auth_error('token_revoked', 'Password changed. Please log in again.')

        return f(data['user_id'], *args, **kwargs)
    decorated.requires_auth = True  # lets tests/tools enumerate protected endpoints
    return decorated


@app.route('/api/stats', methods=['GET'])
@token_required
def get_community_stats(current_user_id):
    """Returns dynamic community stats for the home screen, scoped to the user's locality."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
    
    try:
        cur = conn.cursor()
        
        # Get user's locality
        cur.execute("SELECT locality_id FROM users WHERE id = %s", (current_user_id,))
        user_row = cur.fetchone()
        if not user_row or not user_row[0]:
            return jsonify({"community_members": 0, "issues_solved": 0, "open_issues": 0, "category_counts": {}}), 200
            
        locality_id = user_row[0]
        
        # Count total users as 'neighbors' in the same locality
        cur.execute("SELECT COUNT(*) FROM users WHERE locality_id = %s AND is_active = TRUE", (locality_id,))
        user_count = cur.fetchone()[0]
        
        # Count resolved problems in the locality within the last 30 days
        cur.execute("SELECT COUNT(*) FROM problems WHERE status = 'resolved' AND locality_id = %s AND resolved_at >= NOW() - INTERVAL '30 days'", (locality_id,))
        solved_count = cur.fetchone()[0]
        
        # Count open problems in the locality
        cur.execute("SELECT COUNT(*) FROM problems WHERE status = 'open' AND locality_id = %s", (locality_id,))
        open_count = cur.fetchone()[0]

        # Count problems by category in the locality
        cur.execute("""
            SELECT c.name, COUNT(p.id) 
            FROM categories c
            LEFT JOIN problems p ON c.id = p.category_id AND p.status = 'open' AND p.locality_id = %s
            GROUP BY c.name
        """, (locality_id,))
        category_counts = {row[0]: row[1] for row in cur.fetchall()}
        
        return jsonify({
            "community_members": user_count,
            "issues_solved": solved_count,
            "open_issues": open_count,
            "category_counts": category_counts
        }), 200
    except Exception as e:
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        try:
            if 'cur' in locals() and cur is not None:
                cur.close()
        except Exception:
            pass
        if conn is not None:
            conn.close()

def validate_password(password):
    """Return an error message, or None if acceptable.  (bcrypt only uses the first 72 bytes.)"""
    if not isinstance(password, str) or len(password) < 6:
        return "Password must be at least 6 characters."
    if len(password.encode('utf-8')) > 72:
        return "Password must be at most 72 bytes."
    return None


# Register sprint blueprint after token_required definition
from sprint import sprint_bp
app.register_blueprint(sprint_bp)  # registered exactly once, here (server.py only wraps this app)

# --- Phase 5 API Endpoints ---
@app.route('/api/auth/register', methods=['POST'])
def register():
    schema = RegisterSchema()
    errors = schema.validate(request.json)
    if errors:
        return jsonify({"errors": errors}), 400
        
    data = schema.load(request.json)
    email = data['email']
    password = data['password']
    name = data['name']
    phone = data.get('phone', '')
    
    lat = data.get('latitude') if data.get('latitude') is not None else data.get('home_lat')
    lon = data.get('longitude') if data.get('longitude') is not None else data.get('home_lon')
    role_id = data.get('role_id', 1)
    role_str = 'resident' if role_id == 1 else 'helper'
    
    if lat is None or lon is None:
        return jsonify({"error": "Coordinates (home_lat/home_lon) are required."}), 400
        
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        return jsonify({"error": "Invalid coordinates"}), 400
        
    locality = reverse_geocode(lat, lon)
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Anti-Fake Check 1: Duplicate Email
        cur.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(%s)", (email,))
        if cur.fetchone():
            return jsonify({"error": "An account with this email address already exists."}), 409

        # Anti-Fake Check 2: Duplicate Phone Number
        clean_phone = ''.join(c for c in str(phone) if c.isdigit())
        if clean_phone:
            cur.execute("SELECT id FROM users WHERE phone = %s OR phone = %s", (phone, clean_phone))
            if cur.fetchone():
                return jsonify({"error": "This mobile phone number is already registered to another Samanvi account."}), 409

        # Anti-Fake Check 3: Duplicate Aadhaar Hash
        aad_raw = data.get('aadhaar') or data.get('aadhaar_number') or ''
        clean_aad = ''.join(c for c in str(aad_raw) if c.isdigit())
        if len(clean_aad) == 12:
            import hashlib
            h_aad = hashlib.sha256(clean_aad.encode('utf-8')).hexdigest()
            cur.execute("SELECT id FROM users WHERE aadhaar_hash = %s", (h_aad,))
            if cur.fetchone():
                return jsonify({"error": "This Aadhaar card is already linked to another Samanvi account."}), 409
            
        nickname = (data.get('nickname') or name.split()[0]).strip()
        cur.execute(
            """
            INSERT INTO users (
                email, password_hash, name, full_name, nickname, phone, latitude, longitude, address,
                role, home_lat, home_lon, home_locality, home_verified, community_radius_km, trust_score
            ) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, 1, 50.0) 
            RETURNING id, email, name, full_name, nickname
            """,
            (email, hashed_password, name, name, nickname, phone, lat, lon, locality, role_str, lat, lon, locality)
        )
        new_user = cur.fetchone()
        user_id = new_user['id']
        
        selected_skills = data.get('skills', [])
        if selected_skills:
            for skill in selected_skills:
                cur.execute(
                    "INSERT INTO user_skills (user_id, skill_name) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (user_id, skill)
                )
                
        # Insert welcome bonus history
        cur.execute(
            """
            INSERT INTO trust_score_history (user_id, score_change, reason)
            VALUES (%s, 50, 'Welcome bonus')
            """,
            (str(user_id),)
        )
        
        conn.commit()
        
        token = create_access_token(user_id)
        
        return jsonify({
            "message": f"Welcome to {locality} community",
            "token": token,
            "user_id": str(user_id),
            "community": locality,
            "radius_km": 1,
            "user": {
                "id": str(user_id),
                "email": email,
                "name": name,
                "role": role_str,
                "home_locality": locality,
                "community_radius_km": 1,
                "trust_score": 50.0,
                "latitude": lat,
                "longitude": lon,
                "address": locality
            }
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("10 per minute")
@limiter.limit("60 per hour")
def login():
    data = request.get_json(silent=True) or {}
    identifier = data.get('email') or data.get('phone') or data.get('identifier')
    password = data.get('password')

    if not identifier or not password:
        return jsonify({"error": "Email/Phone and password are required."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cur = None
    try:
        clean_id = ''.join(c for c in str(identifier) if c.isdigit())
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT id, email, password_hash, name, phone, role, trust_score, availability_status, latitude, longitude, address 
            FROM users 
            WHERE (LOWER(email) = LOWER(%s) OR phone = %s OR (%s <> '' AND phone = %s)) AND is_active = TRUE
            """, 
            (identifier, identifier, clean_id, clean_id)
        )
        user_record = cur.fetchone()

        is_valid = False
        if user_record:
            phash = user_record['password_hash']
            if phash.startswith('scrypt:') or phash.startswith('pbkdf2:'):
                from werkzeug.security import check_password_hash as w_check
                is_valid = w_check(phash, password)
                if is_valid:  # transparently upgrade legacy hashes to bcrypt
                    cur.execute("UPDATE users SET password_hash = %s WHERE id = %s",
                                (bcrypt.generate_password_hash(password).decode('utf-8'), user_record['id']))
                    conn.commit()
            else:
                try:
                    is_valid = bcrypt.check_password_hash(phash, password)
                except Exception:
                    is_valid = False

        if is_valid:
            token = create_access_token(user_record['id'])

            user_data = {
                "id": str(user_record['id']),
                "email": user_record['email'],
                "name": user_record['name'],
                "phone": user_record.get('phone', ''),
                "role": user_record['role'],
                "trust_score": user_record['trust_score'],
                "availability_status": user_record['availability_status'],
                "latitude": float(user_record['latitude']) if user_record['latitude'] else None,
                "longitude": float(user_record['longitude']) if user_record['longitude'] else None,
                "address": user_record.get('address', '')
            }

            return jsonify({"message": "Login successful", "token": token, "user": user_data}), 200
        else:
            return jsonify({"error": "Invalid email/phone or password"}), 401
    finally:
        if cur:
            cur.close()
        conn.close()

def _user_public_payload(u):
    return {
        "id": str(u['id']), "email": u['email'], "name": u['name'], "phone": u.get('phone', ''),
        "role": u['role'], "trust_score": u['trust_score'], "availability_status": u['availability_status'],
        "latitude": float(u['latitude']) if u['latitude'] else None,
        "longitude": float(u['longitude']) if u['longitude'] else None,
        "address": u.get('address', ''),
    }


def _phone_variants(phone):
    return (phone, f"91{phone}", f"+91{phone}")


@app.route('/api/auth/login-with-otp', methods=['POST'])
@limiter.limit("10 per minute")
@limiter.limit("30 per hour")
def login_with_otp():
    """Log in with a phone OTP.  The code is verified server-side (hashed, expiring, single-use, attempt-limited)."""
    data = request.get_json(silent=True) or {}
    phone = otp_service.normalize_phone(data.get('phone'))
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Service temporarily unavailable"}), 503
    cur = None
    try:
        otp_service.verify_challenge(conn, phone, 'login', data.get('otp'))
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT id, email, name, phone, role, trust_score, availability_status, latitude, longitude, address
               FROM users WHERE phone IN %s AND is_active = TRUE""",
            (_phone_variants(phone),),
        )
        user_record = cur.fetchone()
        if not user_record:
            return jsonify({"error": "Invalid or expired code", "code": "invalid_code"}), 400
        return jsonify({"message": "OTP Login successful", "token": create_access_token(user_record['id']),
                        "user": _user_public_payload(user_record)}), 200
    finally:
        if cur:
            cur.close()
        conn.close()


@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout(current_user_id):
    """Revoke the presented token server-side (it is rejected from now on, on every device)."""
    token = _bearer_token()
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        return _auth_error('token_invalid', 'Invalid authentication token')
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Service temporarily unavailable"}), 503
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO token_blacklist (jti, expires_at) VALUES (%s, to_timestamp(%s)) ON CONFLICT DO NOTHING",
                    (payload['jti'], payload['exp']))
        conn.commit()
        cur.close()
        return jsonify({"message": "Logged out successfully"}), 200
    finally:
        conn.close()


@app.route('/api/auth/reset-password', methods=['POST'])
@limiter.limit("5 per hour")
def reset_password_api():
    """Reset a password.  Requires the single-use token returned by /auth/verify-phone-otp
    (purpose='password_reset'), i.e. proof the caller controls the account's phone."""
    data = request.get_json(silent=True) or {}
    phone = otp_service.normalize_phone(data.get('phone'))
    new_password = data.get('new_password')
    problem = validate_password(new_password)
    if problem:
        return jsonify({"error": problem, "code": "weak_password"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Service temporarily unavailable"}), 503
    cur = None
    try:
        otp_service.consume_verification_token(conn, data.get('verification_token'), 'password_reset', phone)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id FROM users WHERE phone IN %s AND is_active = TRUE", (_phone_variants(phone),))
        user_record = cur.fetchone()
        if not user_record:
            return jsonify({"error": "Could not reset password", "code": "reset_failed"}), 400
        hashed = bcrypt.generate_password_hash(new_password).decode('utf-8')
        # password_changed_at invalidates every token issued before now.
        # Stamp with the application clock (the same clock that stamps token 'iat').
        cur.execute("UPDATE users SET password_hash = %s, password_changed_at = %s WHERE id = %s",
                    (hashed, datetime.datetime.now(datetime.timezone.utc), user_record['id']))
        conn.commit()
        return jsonify({"message": "Password reset successfully. Please log in again."}), 200
    except OtpError:
        raise
    except Exception:
        conn.rollback()
        app.logger.exception("reset-password failed")
        return jsonify({"error": "Could not reset password", "code": "reset_failed"}), 500
    finally:
        if cur:
            cur.close()
        conn.close()

@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_user_profile(current_user_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, email, name, phone, role, trust_score, availability_status, created_at, avatar_url, address, bio, description, verification_level, phone_verified, home_verified
            FROM users WHERE id = %s
        """, (current_user_id,))
        user = cur.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if user['created_at']:
            user['created_at'] = user['created_at'].isoformat()

        cur.execute("SELECT skill_name FROM user_skills WHERE user_id = %s", (current_user_id,))
        user['skills'] = [s['skill_name'] for s in cur.fetchall()]

        cur.execute("""
            SELECT COUNT(DISTINCT p.user_id) 
            FROM help_offers ho 
            JOIN problems p ON ho.problem_id = p.id 
            WHERE ho.helper_id = %s AND ho.status = 'completed'
        """, (current_user_id,))
        user['people_helped'] = cur.fetchone()['count']
        
        cur.execute("SELECT COUNT(*) FROM help_offers WHERE helper_id = %s AND status = 'completed'", (current_user_id,))
        user['community_helps'] = cur.fetchone()['count']

        cur.execute("SELECT COUNT(*) FROM problems WHERE user_id = %s", (current_user_id,))
        user['helps_received'] = cur.fetchone()['count']

        return jsonify({"profile": user}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/user/activity', methods=['GET'])
@token_required
def get_user_activity(current_user_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Requests (problems posted by current user)
        cur.execute("""
            SELECT p.id, p.title, p.description, p.category_id, p.status, p.priority,
                   p.user_id, p.assigned_helper_id, p.locality_id, p.is_active,
                   p.created_at, p.updated_at, p.post_type, p.budget_range,
                   p.resolution_photo_url, p.rating, p.category, p.helper_id,
                   p.resolved_at, p.photo_url, p.resolved_by_helper_id,
                   p.latitude, p.longitude, c.name as category_name,
                   (SELECT COUNT(*) FROM help_offers o WHERE o.problem_id = p.id) as offer_count
            FROM problems p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.user_id = %s
            ORDER BY p.created_at DESC
        """, (current_user_id,))
        requests_list = cur.fetchall()
        for r in requests_list:
            r['id'] = str(r['id'])
            if r['category_id']: r['category_id'] = str(r['category_id'])
            if r['created_at']: r['created_at'] = r['created_at'].isoformat()
        
        # 2. Helped (problems where current user has offered help)
        cur.execute("""
            SELECT DISTINCT p.id, p.title, p.description, p.category_id, p.status, p.priority,
                   p.user_id, p.assigned_helper_id, p.locality_id, p.is_active,
                   p.created_at, p.updated_at, p.post_type, p.budget_range,
                   p.resolution_photo_url, p.rating, p.category, p.helper_id,
                   p.resolved_at, p.photo_url, p.resolved_by_helper_id,
                   p.latitude, p.longitude, c.name as category_name, o.status as offer_status,
                   (SELECT COUNT(*) FROM help_offers o2 WHERE o2.problem_id = p.id) as offer_count
            FROM problems p
            JOIN help_offers o ON p.id = o.problem_id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE o.helper_id = %s
            ORDER BY p.created_at DESC
        """, (current_user_id,))
        helped_list = cur.fetchall()
        for h in helped_list:
            h['id'] = str(h['id'])
            if h['category_id']: h['category_id'] = str(h['category_id'])
            if h['created_at']: h['created_at'] = h['created_at'].isoformat()
            
        return jsonify({
            "requests": requests_list,
            "helped": helped_list
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/users/nearby', methods=['GET'])
@token_required
def get_nearby_users(current_user_id):
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    if not lat or not lng:
        return jsonify({"error": "Missing lat/lng"}), 400
    
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # We fetch active users and assign a slight jitter around the provided coordinates
        # to simulate their real-time location in the vicinity.
        cur.execute("""
            SELECT id, name, role, trust_score 
            FROM users 
            WHERE id != %s AND is_active = TRUE
            LIMIT 10
        """, (current_user_id,))
        users = cur.fetchall()
        
        import random
        for u in users:
            u['lat'] = lat + random.uniform(-0.005, 0.005)
            u['lng'] = lng + random.uniform(-0.005, 0.005)
            
        return jsonify({"users": users})
    except Exception as e:
        print(f"Error fetching nearby users: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/api/users/<uuid:user_id>', methods=['GET'])
def get_public_profile(user_id):
    """Publicly accessible profile information for the 'Helper Profile' screen."""
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT u.id, u.name, COALESCE(u.full_name, u.name) as full_name, COALESCE(u.nickname, u.name) as nickname,
                   u.role, u.trust_score, u.availability_status, u.created_at, u.avatar_url,
                   COALESCE(loc.name, 'Local Community') as address,
                   u.bio, u.description,
                   (COALESCE(u.is_verified, FALSE) OR COALESCE(u.aadhaar_verified, FALSE)) as is_verified
            FROM users u
            LEFT JOIN localities loc ON u.locality_id = loc.id
            WHERE u.id = %s
        """, (str(user_id),))
        user = cur.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        if user['created_at']:
            user['created_at'] = user['created_at'].strftime('%B %Y')

        # Strictly sanitize and filter sensitive internal fields out
        user.pop('aadhaar_verified', None)
        user.pop('aadhaar_last4', None)
        user.pop('aadhaar_hash', None)
        user.pop('phone', None)
        user.pop('email', None)

        cur.execute("SELECT skill_name as name FROM user_skills WHERE user_id = %s", (str(user_id),))
        user['skills'] = [s['name'] for s in cur.fetchall()]

        cur.execute("""
            SELECT COUNT(DISTINCT p.user_id) 
            FROM help_offers ho 
            JOIN problems p ON ho.problem_id = p.id 
            WHERE ho.helper_id = %s AND ho.status = 'completed'
        """, (str(user_id),))
        user['people_helped'] = cur.fetchone()['count']
        
        cur.execute("SELECT COUNT(*) FROM help_offers WHERE helper_id = %s AND status = 'completed'", (str(user_id),))
        user['community_helps'] = cur.fetchone()['count']

        cur.execute("SELECT COUNT(*) FROM problems WHERE user_id = %s", (str(user_id),))
        user['helps_received'] = cur.fetchone()['count']

        # Fetch dynamic reviews from resolved problems
        cur.execute("""
            SELECT p.id, u.name as author, p.rating, p.title as problem_title, p.resolved_at as created_at
            FROM problems p
            JOIN users u ON p.user_id = u.id
            WHERE p.helper_id = %s AND p.status = 'resolved' AND p.rating > 0
            ORDER BY p.resolved_at DESC
            LIMIT 5
        """, (str(user_id),))
        resolved_problems = cur.fetchall()
        reviews = []
        for rp in resolved_problems:
            reviews.append({
                "id": str(rp["id"]),
                "author": rp["author"],
                "rating": rp["rating"],
                "date": rp["created_at"].strftime('%Y-%m-%d') if rp["created_at"] else "Recently",
                "text": f"Helped with: {rp['problem_title']}"
            })
        user['reviews'] = reviews

        return jsonify({"profile": user}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/user/profile', methods=['PUT'])
@token_required
def update_user_profile(current_user_id):
    data = request.get_json(silent=True)
    name = data.get('name')
    phone = data.get('phone')
    bio = data.get('bio')
    description = data.get('description')
    availability = data.get('availability_status')

    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            UPDATE users SET name = %s, phone = %s, bio = %s, description = %s, availability_status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s RETURNING id, name, phone, bio, description, availability_status
        """, (name, phone, bio, description, availability, current_user_id))
        updated_user = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Profile updated successfully", "user": updated_user}), 200
    except Exception as e:
        conn.rollback()
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/user/avatar', methods=['POST'])
@token_required
def upload_avatar(current_user_id):
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        avatar_url = upload_to_cloudinary_or_local(file, folder="avatars", filename_prefix=str(current_user_id))
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute("UPDATE users SET avatar_url = %s WHERE id = %s", (avatar_url, current_user_id))
            conn.commit()
            return jsonify({"message": "Avatar uploaded successfully", "avatar_url": avatar_url}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            cur.close()
            conn.close()
    return jsonify({"error": "Invalid file type"}), 400

@app.route('/api/messages', methods=['GET'])
@token_required
def get_messages(current_user_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = """
            SELECT DISTINCT ON (partner_id)
                partner_id as id, u.name as user, u.avatar_url as avatar, m.message as lastMessage, m.created_at as time,
                (SELECT COUNT(*) FROM messages WHERE sender_id = partner_id AND receiver_id = %s AND is_read = FALSE) as unreadCount
            FROM (
                SELECT CASE WHEN sender_id = %s THEN receiver_id ELSE sender_id END as partner_id, message, created_at
                FROM messages WHERE sender_id = %s OR receiver_id = %s
            ) m JOIN users u ON m.partner_id = u.id ORDER BY partner_id, m.created_at DESC
        """
        cur.execute(query, (current_user_id, current_user_id, current_user_id, current_user_id))
        inbox = cur.fetchall()
        for item in inbox:
            if item.get('lastMessage'):
                item['lastMessage'] = decrypt_message(item['lastMessage'])
            if item['time']: item['time'] = item['time'].strftime('%I:%M %p')
            if not item['avatar']: item['avatar'] = 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png'
        return jsonify({"messages": inbox}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/chat/<recipient_id>', methods=['GET'])
@app.route('/api/chat/<uuid:recipient_id>', methods=['GET'])
@token_required
def get_chat_history(current_user_id, recipient_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        rec_id_str = str(recipient_id)

        # 1. Bidirectional block enforcement
        cur.execute("""
            SELECT 1 FROM user_blocks 
            WHERE (blocker_id = %s AND blocked_id::text = %s) 
               OR (blocker_id::text = %s AND blocked_id = %s)
        """, (current_user_id, rec_id_str, rec_id_str, current_user_id))
        if cur.fetchone():
            return jsonify({"error": "Conversation unavailable due to block settings"}), 403

        cur.execute("UPDATE messages SET is_read = TRUE WHERE sender_id::text = %s AND receiver_id = %s", (rec_id_str, current_user_id))
        conn.commit()
        query = """
            SELECT id, sender_id, receiver_id, message as text, created_at, (sender_id = %s) as "isMe"
            FROM messages WHERE (sender_id = %s AND receiver_id::text = %s) OR (sender_id::text = %s AND receiver_id = %s)
            ORDER BY created_at ASC
        """
        cur.execute(query, (current_user_id, current_user_id, rec_id_str, rec_id_str, current_user_id))
        history = cur.fetchall()
        for msg in history:
            msg['id'] = str(msg['id'])
            if msg.get('text'):
                msg['text'] = decrypt_message(msg['text'])
            if msg['created_at']: msg['time'] = msg['created_at'].strftime('%I:%M %p')
        cur.execute("SELECT name, COALESCE(nickname, name) as nickname, avatar_url FROM users WHERE id::text = %s", (rec_id_str,))
        partner = cur.fetchone()
        return jsonify({"messages": history, "partner": partner or {"name": "Resident", "nickname": "Resident", "avatar_url": None}}), 200
    except Exception as e:
        import traceback
        print(f"Error in get_chat_history: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred while fetching chat history."}), 500
    finally:
        try:
            if 'cur' in locals() and cur is not None:
                cur.close()
        except Exception:
            pass
        if conn is not None:
            conn.close()

@app.route('/api/chat/<recipient_id>/status', methods=['GET'])
@app.route('/api/chat/<uuid:recipient_id>/status', methods=['GET'])
@token_required
def get_chat_status(current_user_id, recipient_id):
    """Returns the active help offer and safety status between current user and recipient."""
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        rec_id_str = str(recipient_id)
        query = """
            SELECT o.id as offer_id, o.status as offer_status, o.arrival_verified,
                   p.id as problem_id, p.title as problem_title, p.status as problem_status, p.user_id as author_id
            FROM help_offers o
            JOIN problems p ON o.problem_id = p.id
            WHERE (p.user_id = %s AND o.helper_id::text = %s) OR (p.user_id::text = %s AND o.helper_id = %s)
            ORDER BY o.created_at DESC
            LIMIT 1
        """
        cur.execute(query, (str(current_user_id), rec_id_str, rec_id_str, str(current_user_id)))
        status = cur.fetchone()
        
        if status:
            status['offer_id'] = str(status['offer_id'])
            status['problem_id'] = str(status['problem_id'])
            status['author_id'] = str(status['author_id'])
            return jsonify({"status": status}), 200
        else:
            return jsonify({"status": None}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/chat/<recipient_id>', methods=['POST'])
@app.route('/api/chat/<uuid:recipient_id>', methods=['POST'])
@token_required
def send_chat_message(current_user_id, recipient_id):
    data = request.get_json(silent=True) or {}
    text = data.get('message') or data.get('text')
    if not text: return jsonify({"error": "Message cannot be empty."}), 400
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        rec_id_str = str(recipient_id)
        cur.execute("SELECT id, name FROM users WHERE id::text = %s LIMIT 1", (rec_id_str,))
        target_user = cur.fetchone()
        if not target_user:
            return jsonify({"error": "Recipient user not found."}), 404
        target_id = str(target_user['id'])

        # Enforce bidirectional block check
        cur.execute("""
            SELECT 1 FROM user_blocks 
            WHERE (blocker_id = %s AND blocked_id::text = %s) 
               OR (blocker_id::text = %s AND blocked_id = %s)
        """, (current_user_id, target_id, target_id, current_user_id))
        if cur.fetchone():
            return jsonify({"error": "Cannot send message due to block settings."}), 403
        
        cur.execute("INSERT INTO messages (sender_id, receiver_id, message) VALUES (%s, %s, %s) RETURNING id, created_at", (current_user_id, target_id, text))
        new_msg = cur.fetchone()
        
        # Get sender name for safe privacy notification teaser
        cur.execute("SELECT name FROM users WHERE id = %s", (current_user_id,))
        sender_row = cur.fetchone()
        sender_name = sender_row['name'] if sender_row else "A neighbor"

        conn.commit()
        time_str = new_msg['created_at'].strftime('%I:%M %p') if new_msg['created_at'] else 'Just now'
        
        # Dispatch notification post-commit
        try:
            from notification_service import create_and_dispatch_notification
            create_and_dispatch_notification(
                get_db_conn_fn=get_db_connection,
                user_id=target_id,
                title="New Message",
                body=f"New message from {sender_name}.",
                notification_type="chat_message",
                related_id=str(new_msg['id']),
                idempotency_key=f"chat_msg_{new_msg['id']}",
                data={"type": "chat_message", "sender_id": str(current_user_id), "message_id": str(new_msg['id'])}
            )
        except Exception as notif_err:
            app.logger.warning("Failed to dispatch chat push notification: %s", notif_err)

        return jsonify({"id": str(new_msg['id']), "text": text, "isMe": True, "time": time_str}), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/helpers', methods=['GET'])
def get_helpers():
    """Fetch trusted nearby helpers for the Helpers tab."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        sort_by = request.args.get('sort', default='top')
        order_clause = "ORDER BY u.trust_score DESC" if sort_by == 'top' else "ORDER BY u.created_at DESC"

        cur.execute(f"""
            SELECT u.id, u.name, COALESCE(u.nickname, u.name) as nickname, u.role, u.trust_score, 
                   u.availability_status, u.avatar_url,
                   COALESCE(loc.name, 'Local Neighborhood') as locality_name,
                   (COALESCE(u.is_verified, FALSE) OR COALESCE(u.aadhaar_verified, FALSE)) as is_verified,
                   ARRAY_AGG(s.skill_name) FILTER (WHERE s.skill_name IS NOT NULL) as skills
            FROM users u
            LEFT JOIN localities loc ON u.locality_id = loc.id
            LEFT JOIN user_skills s ON u.id = s.user_id
            WHERE u.is_active = TRUE
            GROUP BY u.id, loc.name
            {order_clause}
            LIMIT 50
        """)
        rows = cur.fetchall()
        helpers_list = []
        for r in rows:
            helpers_list.append({
                "id": str(r['id']),
                "name": r['nickname'] or r['name'],
                "full_name": r['name'],
                "role": r['role'],
                "trust_score": float(r['trust_score']) if r['trust_score'] else 50.0,
                "availability_status": r['availability_status'] or 'available',
                "avatar_url": r['avatar_url'],
                "address": r['locality_name'] or 'Local Neighborhood',
                "is_verified": bool(r['is_verified']),
                "skills": [s for s in (r['skills'] or []) if s] or ["Community Support", "General Aid"]
            })
        return jsonify({"helpers": helpers_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/problems', methods=['GET'])
@token_required
def get_problems(current_user_id):
    page = request.args.get('page', default=1, type=int)
    page_size = request.args.get('page_size', default=20, type=int)
    category_name = request.args.get('category')
    category_id = request.args.get('category_id')
    post_type = request.args.get('post_type')
    
    offset = (page - 1) * page_size
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get caller's home location
        cur.execute("""
            SELECT home_lat, home_lon, home_locality, community_radius_km 
            FROM users 
            WHERE id = %s AND is_active = TRUE
        """, (current_user_id,))
        user = cur.fetchone()
        
        if not user or user['home_lat'] is None or user['home_lon'] is None:
            return jsonify({"error": "Home location not set. Please update your profile."}), 400
            
        home_lat = float(request.args.get('lat') or user['home_lat'])
        home_lon = float(request.args.get('lng') or request.args.get('lon') or user['home_lon'])
        radius_km = float(request.args.get('radius') or user.get('community_radius_km') or 50.0)
        if radius_km < 10.0:
            radius_km = 50.0  # Expand search radius so users see nearby community problems
        
        # Haversine distance calculation in SQL (km)
        dist_sql = f"(6371 * acos(least(1.0, greatest(-1.0, cos(radians({home_lat})) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians({home_lon})) + sin(radians({home_lat})) * sin(radians(p.latitude))))))"
        
        query = f"""
            SELECT p.id, p.title, p.description, p.category_id, p.status, p.priority,
                   p.user_id, p.assigned_helper_id, p.locality_id, p.is_active,
                   p.created_at, p.updated_at, p.post_type, p.budget_range,
                   p.resolution_photo_url, p.rating, p.category, p.helper_id,
                   p.resolved_at, p.photo_url, p.resolved_by_helper_id,
                   p.latitude, p.longitude,
                   u.name as author_name, u.avatar_url, u.trust_score, c.name as category_name, 
                   {dist_sql} as distance,
                   (SELECT COUNT(*) FROM problem_confirmations pc WHERE pc.problem_id = p.id) as confirmation_count,
                   (SELECT COUNT(*) FROM problem_votes pv WHERE pv.problem_id = p.id) as vote_count,
                   (SELECT COUNT(*) FROM help_offers o WHERE o.problem_id = p.id) as offer_count
            FROM problems p 
            JOIN users u ON p.user_id = u.id 
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = TRUE 
              AND p.status = 'open' 
              AND {dist_sql} <= %s
        """
        params = [radius_km]
        
        # Exclude blocked users (bidirectional block check)
        query += """
            AND p.user_id NOT IN (
                SELECT blocked_id FROM user_blocks WHERE blocker_id = %s
                UNION
                SELECT blocker_id FROM user_blocks WHERE blocked_id = %s
            )
        """
        params.extend([current_user_id, current_user_id])
        
        if category_id:
            query += " AND p.category_id = %s"
            params.append(category_id)
        elif category_name:
            query += " AND c.name = %s"
            params.append(category_name)
            
        if post_type:
            query += " AND p.post_type = %s"
            params.append(post_type)
            
        # Order by priority urgency, confirmation_count desc, distance asc, created_at desc
        query += f"""
            ORDER BY 
              CASE 
                WHEN p.priority = 'critical' THEN 1
                WHEN p.priority = 'high' THEN 2
                WHEN p.priority = 'medium' THEN 3
                WHEN p.priority = 'low' THEN 4
                ELSE 5
              END ASC,
              confirmation_count DESC,
              distance ASC,
              p.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([page_size, offset])
        
        cur.execute(query, tuple(params))
        problems = cur.fetchall()
        
        # Process and anonymize coordinates
        for prob in problems:
            prob['id'] = str(prob['id'])
            prob['user_id'] = str(prob['user_id'])
            if prob.get('category_id'):
                prob['category_id'] = str(prob['category_id'])
            if prob.get('assigned_helper_id'):
                prob['assigned_helper_id'] = str(prob['assigned_helper_id'])
            if prob.get('locality_id'):
                prob['locality_id'] = str(prob['locality_id'])
            if prob.get('helper_id'):
                prob['helper_id'] = str(prob['helper_id'])
            if prob.get('resolved_by_helper_id'):
                prob['resolved_by_helper_id'] = str(prob['resolved_by_helper_id'])
            if prob['created_at']: 
                prob['created_at'] = prob['created_at'].isoformat()
            if prob.get('resolved_at') and prob['resolved_at']: 
                prob['resolved_at'] = prob['resolved_at'].isoformat()
                
            offset_lat, offset_lon = add_location_offset(prob['latitude'], prob['longitude'])
            prob['latitude'] = offset_lat
            prob['longitude'] = offset_lon
            
            if 'distance' in prob and prob['distance'] is not None: 
                prob['distance'] = round(float(prob['distance']), 1)
                
        return jsonify({
            "problems": problems,
            "community": user['home_locality'],
            "radius_km": radius_km
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/problems/<uuid:id>', methods=['GET'])
def get_single_problem(id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT p.id, p.title, p.description, p.category_id, p.status, p.priority,
                   p.user_id, p.assigned_helper_id, p.locality_id, p.is_active,
                   p.created_at, p.updated_at, p.post_type, p.budget_range,
                   p.resolution_photo_url, p.rating, p.category, p.helper_id,
                   p.resolved_at, p.photo_url, p.resolved_by_helper_id,
                   p.latitude, p.longitude,
                   u.name as author_name, u.avatar_url, u.trust_score,
                   COALESCE(loc.name, 'Local Community') as address,
                   c.name as category_name,
                   (SELECT COUNT(*) FROM problem_confirmations WHERE problem_id = p.id) as confirmation_count,
                   (SELECT COUNT(*) FROM problem_votes WHERE problem_id = p.id) as vote_count
            FROM problems p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN localities loc ON p.locality_id = loc.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = %s AND p.is_active = TRUE
        """, (str(id),))
        problem = cur.fetchone()
        if not problem:
            return jsonify({"error": "Problem not found"}), 404
            
        # Cast UUID fields to string for JSON serialization
        problem['id'] = str(problem['id'])
        problem['user_id'] = str(problem['user_id'])
        if problem.get('category_id'):
            problem['category_id'] = str(problem['category_id'])
        if problem.get('assigned_helper_id'):
            problem['assigned_helper_id'] = str(problem['assigned_helper_id'])
        if problem.get('locality_id'):
            problem['locality_id'] = str(problem['locality_id'])
        if problem.get('helper_id'):
            problem['helper_id'] = str(problem['helper_id'])
        if problem['created_at']:
            problem['created_at'] = problem['created_at'].isoformat()
        if problem.get('resolved_at'):
            problem['resolved_at'] = problem['resolved_at'].isoformat()
            
        # Anonymize coordinates to preserve reporter's residential privacy
        if problem.get('latitude') is not None and problem.get('longitude') is not None:
            offset_lat, offset_lon = add_location_offset(problem['latitude'], problem['longitude'])
            problem['latitude'] = offset_lat
            problem['longitude'] = offset_lon
            
        return jsonify({"problem": problem}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/api/problems', methods=['POST'])
@limiter.limit("10 per hour")
@token_required
def create_problem(current_user_id):
    schema = CreateProblemSchema()
    errors = schema.validate(request.json)
    if errors:
        return jsonify({"errors": errors}), 400
        
    data = schema.load(request.json)
    title = data['title']
    description = data['description']
    
    lat = data.get('latitude') if data.get('latitude') is not None else data.get('lat')
    lng = data.get('longitude') if data.get('longitude') is not None else data.get('lon')
    priority = data.get('priority', 'medium').lower()
    post_type = data.get('post_type', 'free_help')
    budget_range = data.get('budget_range') if post_type == 'paid_help' else None
    
    photo_url = request.json.get('photo_url')
    category_name = data.get('category')
    category_id = data.get('category_id') if data.get('category_id') is not None else data.get('cat_id')
    
    if lat is None or lng is None:
        return jsonify({"error": "Location coordinates are required."}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get caller's home location to enforce community lock boundary
        cur.execute("""
            SELECT home_lat, home_lon, home_locality, community_radius_km, locality_id
            FROM users WHERE id = %s AND is_active = TRUE
        """, (current_user_id,))
        user_row = cur.fetchone()
        
        if not user_row or user_row['home_lat'] is None or user_row['home_lon'] is None:
            return jsonify({"error": "Home location not set. Please update your profile first."}), 400
            
        # Verify boundary
        within, distance_km = is_within_community(
            user_row['home_lat'], user_row['home_lon'],
            lat, lng,
            user_row['community_radius_km']
        )
        
        if not within:
            return jsonify({
                "error": "You can only post problems in your home community",
                "your_community": user_row['home_locality'],
                "max_radius_km": user_row['community_radius_km']
            }), 403
            
        locality_id = user_row['locality_id']
        
        # Resolve category
        resolved_category_id = None
        if category_id:
            resolved_category_id = category_id
        elif category_name:
            cur.execute("SELECT id FROM categories WHERE name = %s", (category_name,))
            cat_row = cur.fetchone()
            if cat_row:
                resolved_category_id = cat_row['id']
                
        cur.execute("""
            INSERT INTO problems (
                user_id, title, description, latitude, longitude, status, photo_url, priority, 
                category_id, locality_id, post_type, budget_range
            ) 
            VALUES (%s, %s, %s, %s, %s, 'open', %s, %s, %s, %s, %s, %s) 
            RETURNING id, title, created_at, photo_url, priority, category_id, post_type, budget_range
        """, (
            str(current_user_id), title, description, lat, lng, photo_url, priority, 
            resolved_category_id, locality_id, post_type, budget_range
        ))
        new_problem = cur.fetchone()
        conn.commit()
        
        if new_problem:
            new_problem['id'] = str(new_problem['id'])
            if new_problem.get('category_id'):
                new_problem['category_id'] = str(new_problem['category_id'])
            if new_problem['created_at']: 
                new_problem['created_at'] = new_problem['created_at'].isoformat()
                
        return jsonify({
            "message": f"Problem posted successfully to {user_row['home_locality']}", 
            "problem": new_problem
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/api/problems/upload', methods=['POST'])
@token_required
def upload_problem_photo(current_user_id):
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        photo_url = upload_to_cloudinary_or_local(file, folder="problems", filename_prefix=str(current_user_id))
        return jsonify({"message": "Photo uploaded successfully", "photo_url": photo_url}), 200
    
    return jsonify({"error": "Invalid file type"}), 400

@app.route('/api/problems/<uuid:id>', methods=['PUT'])
@token_required
def edit_problem(current_user_id, id):
    data = request.get_json(silent=True)
    title = data.get('title')
    description = data.get('description')
    
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Verify ownership
        cur.execute("SELECT user_id FROM problems WHERE id = %s", (str(id),))
        problem = cur.fetchone()
        if not problem:
            return jsonify({"error": "Problem not found"}), 404
        if str(problem['user_id']) != str(current_user_id):
            return jsonify({"error": "Unauthorized: Only the author can edit this problem."}), 403
            
        cur.execute("""
            UPDATE problems 
            SET title = COALESCE(%s, title), description = COALESCE(%s, description), updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (title, description, str(id)))
        conn.commit()
        return jsonify({"message": "Updated successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/problems/<uuid:id>', methods=['DELETE'])
@token_required
def delete_problem(current_user_id, id):
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Verify ownership
        cur.execute("SELECT user_id FROM problems WHERE id = %s", (str(id),))
        problem = cur.fetchone()
        if not problem:
            return jsonify({"error": "Problem not found"}), 404
        if str(problem['user_id']) != str(current_user_id):
            return jsonify({"error": "Unauthorized: Only the author can delete this problem."}), 403
            
        cur.execute("DELETE FROM problems WHERE id = %s", (str(id),))
        conn.commit()
        return jsonify({"message": "Deleted successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/problems/<uuid:problem_id>/resolve', methods=['PUT'])
@token_required
def resolve_problem(current_user_id, problem_id):
    data = request.get_json(silent=True)
    helper_id = data.get('helper_id')
    rating = data.get('rating', 0) # 1-5 stars

    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Verify ownership and derive authoritative assigned helper
        cur.execute("SELECT user_id, assigned_helper_id, title FROM problems WHERE id = %s", (str(problem_id),))
        problem = cur.fetchone()
        
        if not problem:
            return jsonify({"error": "Problem not found"}), 404
        if str(problem['user_id']) != str(current_user_id):
            return jsonify({"error": "Unauthorized: Only the author can resolve this problem."}), 403

        # Derive authoritative assigned helper from DB state
        authoritative_helper = problem.get('assigned_helper_id')
        if not authoritative_helper:
            # Fallback to accepted help offer helper
            cur.execute("SELECT helper_id FROM help_offers WHERE problem_id = %s AND status IN ('accepted', 'active') LIMIT 1", (str(problem_id),))
            offer_row = cur.fetchone()
            if offer_row:
                authoritative_helper = offer_row['helper_id']
        
        # Prefer authoritative helper over client-supplied ID
        target_helper_id = authoritative_helper or helper_id

        # Update problem
        cur.execute("""
            UPDATE problems 
            SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                helper_id = %s, rating = %s
            WHERE id = %s RETURNING id, status, resolved_at
        """, (str(target_helper_id) if target_helper_id else None, rating, str(problem_id)))
        res = cur.fetchone()
        if res:
            res['id'] = str(res['id'])
            if res.get('resolved_at'): res['resolved_at'] = res['resolved_at'].isoformat()

        # Update Helper Community Score (Task 4.3 point-based rules)
        if target_helper_id:
            # Base completion score
            points = 10
            # Additional score based on rating
            if rating >= 4:
                points += 5
            elif rating == 3:
                points += 2
                
            cur.execute("UPDATE users SET trust_score = trust_score + %s WHERE id = %s", (points, str(target_helper_id)))
            cur.execute("""
                INSERT INTO trust_score_history (user_id, score_change, reason, related_problem_id)
                VALUES (%s, %s, 'Problem completed with rating %s', %s)
            """, (str(target_helper_id), points, rating, str(problem_id)))

        conn.commit()

        # Dispatch push notification to assigned helper post-commit
        if target_helper_id:
            try:
                from notification_service import create_and_dispatch_notification
                create_and_dispatch_notification(
                    get_db_conn_fn=get_db_connection,
                    user_id=target_helper_id,
                    title="Problem Resolved",
                    body="A problem you helped with was marked resolved! Points have been awarded.",
                    notification_type="problem_resolved",
                    related_id=str(problem_id),
                    idempotency_key=f"problem_resolve_{problem_id}",
                    data={"type": "problem_resolved", "problem_id": str(problem_id)}
                )
            except Exception as notif_err:
                app.logger.warning("Failed to dispatch resolve push notification: %s", notif_err)

        return jsonify({"message": "Problem resolved and points awarded!", "problem": res}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/problems/<uuid:problem_id>/helpers', methods=['GET'])
@token_required
def get_problem_helpers(current_user_id, problem_id):
    """List everyone who chatted with the author about this problem."""
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT DISTINCT u.id, u.name, u.avatar_url, u.trust_score
            FROM users u
            JOIN messages m ON (u.id = m.sender_id OR u.id = m.receiver_id)
            WHERE (m.sender_id = %s OR m.receiver_id = %s)
            AND u.id != %s
            LIMIT 10
        """, (str(current_user_id), str(current_user_id), str(current_user_id)))
        helpers = cur.fetchall()
        for h in helpers:
            h['id'] = str(h['id'])
        return jsonify({"helpers": helpers}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/problems/<uuid:problem_id>/offers', methods=['GET'])
def get_problem_offers(problem_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Fetch public offers and join with user info, offer status, and helper skills
        cur.execute("""
            SELECT o.id, o.user_id, o.content as text, o.created_at,
                   u.name as user, u.avatar_url as avatar, u.trust_score,
                   COALESCE(ho.status, 'comment') as status,
                   COALESCE((SELECT string_agg(skill_name, ', ') FROM user_skills WHERE user_id = u.id), '') as skills
            FROM problem_offers o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN help_offers ho ON o.id = ho.id
            WHERE o.problem_id = %s
            ORDER BY o.created_at ASC
        """, (str(problem_id),))
        offers = cur.fetchall()
        for o in offers:
            o['id'] = str(o['id'])
            o['user_id'] = str(o['user_id'])
            if o['created_at']:
                o['time'] = o['created_at'].isoformat()
        return jsonify({"offers": offers}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/problems/<uuid:problem_id>/offers', methods=['POST'])
@token_required
def post_problem_offer(current_user_id, problem_id):
    data = request.get_json(silent=True)
    content = data.get('content')
    if not content: return jsonify({"error": "Offer content cannot be empty."}), 400
    
    import uuid
    offer_id = str(uuid.uuid4())
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # 1. Insert into public comments problem_offers
        cur.execute("""
            INSERT INTO problem_offers (id, problem_id, user_id, content)
            VALUES (%s, %s, %s, %s) RETURNING id, created_at
        """, (offer_id, str(problem_id), str(current_user_id), content))
        new_offer = cur.fetchone()
        
        # 2. Insert into workflow help_offers if the poster is not the problem author
        cur.execute("SELECT user_id FROM problems WHERE id = %s", (str(problem_id),))
        problem = cur.fetchone()
        if problem and str(problem['user_id']) != str(current_user_id):
            cur.execute("""
                INSERT INTO help_offers (id, problem_id, helper_id, status, message)
                VALUES (%s, %s, %s, 'pending', %s)
                ON CONFLICT (problem_id, helper_id) DO NOTHING
            """, (offer_id, str(problem_id), str(current_user_id), content))
            
        conn.commit()
        if new_offer:
            new_offer['id'] = str(new_offer['id'])
            if new_offer['created_at']: new_offer['created_at'] = new_offer['created_at'].isoformat()

        # Dispatch notification to problem owner post-commit
        if problem and str(problem['user_id']) != str(current_user_id):
            try:
                from notification_service import create_and_dispatch_notification
                create_and_dispatch_notification(
                    get_db_conn_fn=get_db_connection,
                    user_id=problem['user_id'],
                    title="New Help Offer",
                    body="A neighbor offered to help with your request.",
                    notification_type="new_offer",
                    related_id=str(problem_id),
                    idempotency_key=f"new_offer_{offer_id}",
                    data={"type": "new_offer", "problem_id": str(problem_id), "offer_id": str(offer_id)}
                )
            except Exception as notif_err:
                app.logger.warning("Failed to dispatch offer notification: %s", notif_err)

        return jsonify({"message": "Offer posted!", "offer": new_offer}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/api/offers/cancel', methods=['POST'])
@token_required
def cancel_offer(current_user_id):
    data = request.get_json(silent=True)
    offer_id = data.get('offer_id')
    if not offer_id:
        return jsonify({"error": "offer_id is required"}), 400
        
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Fetch details
        cur.execute("""
            SELECT o.helper_id, o.problem_id, o.status, p.user_id as resident_id
            FROM help_offers o
            JOIN problems p ON o.problem_id = p.id
            WHERE o.id = %s
        """, (str(offer_id),))
        offer = cur.fetchone()
        if not offer:
            return jsonify({"error": "Offer not found"}), 404
            
        if str(offer['helper_id']) != str(current_user_id):
            return jsonify({"error": "Unauthorized: Only the helper can cancel their offer."}), 403
            
        if offer.get('status') == 'cancelled':
            return jsonify({"message": "Offer already cancelled successfully."}), 200
            
        # 2. Perform updates inside transaction
        # Update offer status to cancelled
        cur.execute("UPDATE help_offers SET status = 'cancelled' WHERE id = %s", (str(offer_id),))
        
        # Deduct community score
        cur.execute("""
            INSERT INTO trust_score_history (user_id, score_change, reason, related_problem_id)
            VALUES (%s, -5, 'Offer cancelled by helper', %s)
        """, (str(current_user_id), str(offer['problem_id'])))
        
        cur.execute("UPDATE users SET trust_score = trust_score - 5 WHERE id = %s", (str(current_user_id),))
        
        # Free up problem
        cur.execute("""
            UPDATE problems 
            SET status = 'open', assigned_helper_id = NULL 
            WHERE id = %s AND assigned_helper_id = %s
        """, (str(offer['problem_id']), str(current_user_id)))
        
        conn.commit() # Commit transaction

        # Dispatch notification to resident post-commit
        try:
            from notification_service import create_and_dispatch_notification
            create_and_dispatch_notification(
                get_db_conn_fn=get_db_connection,
                user_id=offer['resident_id'],
                title="Offer Cancelled",
                body="The helper has cancelled their offer for your problem.",
                notification_type="offer_cancelled",
                related_id=str(offer['problem_id']),
                idempotency_key=f"offer_cancel_{offer_id}",
                data={"type": "offer_cancelled", "offer_id": str(offer_id), "problem_id": str(offer['problem_id'])}
            )
        except Exception as notif_err:
            app.logger.warning("Failed to dispatch cancel notification: %s", notif_err)

        return jsonify({"message": "Offer cancelled successfully, points deducted."}), 200
    except Exception as e:
        conn.rollback() # Rollback transaction
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# --- Physical Safety and Trust Framework Endpoints ---

@app.route('/api/offers/<uuid:offer_id>/accept', methods=['POST'])
@token_required
def accept_offer(current_user_id, offer_id):
    """Resident accepts a help offer, starting a secure session with a 6-digit arrival code."""
    data = request.get_json(silent=True)
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # 1. Verify that the current user is the owner of the problem and fetch helper
        cur.execute("""
            SELECT p.id, p.user_id, o.helper_id 
            FROM problems p 
            JOIN help_offers o ON p.id = o.problem_id 
            WHERE o.id = %s
        """, (str(offer_id),))
        record = cur.fetchone()
        
        if not record or str(record['user_id']) != str(current_user_id):
            return jsonify({"error": "Unauthorized: Only the problem author can accept offers."}), 403

        # 2. Generate a secure 6-digit numeric code for physical verification
        import secrets
        import hashlib
        arrival_code = str(secrets.randbelow(900000) + 100000)
        arrival_code_hash = hashlib.sha256(arrival_code.encode('utf-8')).hexdigest()
        
        # Expiry is 10 minutes from now
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)

        # 3. Update offer status and arrival code parameters
        cur.execute("""
            UPDATE help_offers 
            SET status = 'accepted', 
                arrival_code = %s, 
                arrival_code_expires_at = %s, 
                arrival_code_attempts = 0, 
                arrival_verified = FALSE 
            WHERE id = %s RETURNING id, status
        """, (arrival_code_hash, expires_at, str(offer_id)))
        updated_offer = cur.fetchone()
        if updated_offer:
            updated_offer['id'] = str(updated_offer['id'])
            # Expose the plain code only in the accept response so the resident can see it
            updated_offer['arrival_code'] = arrival_code
        
        # 4. Mark problem as assigned
        cur.execute("UPDATE problems SET status = 'assigned', assigned_helper_id = (SELECT helper_id FROM help_offers WHERE id = %s) WHERE id = %s", (str(offer_id), str(record['id'])))
        
        conn.commit()

        # Dispatch push notification to assigned helper post-commit
        if record and record.get('helper_id'):
            try:
                from notification_service import create_and_dispatch_notification
                create_and_dispatch_notification(
                    get_db_conn_fn=get_db_connection,
                    user_id=record['helper_id'],
                    title="Offer Accepted!",
                    body="Your offer was accepted. Tap to view details and coordinate arrival.",
                    notification_type="offer_accepted",
                    related_id=str(offer_id),
                    idempotency_key=f"offer_accept_{offer_id}",
                    data={"type": "offer_accepted", "offer_id": str(offer_id), "problem_id": str(record['id'])}
                )
            except Exception as notif_err:
                app.logger.warning("Failed to dispatch accept notification: %s", notif_err)

        return jsonify({
            "message": "Offer accepted successfully. Please share the arrival code with the helper upon their arrival.",
            "offer": updated_offer
        }), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/offers/<uuid:offer_id>/decline', methods=['POST'])
@token_required
def decline_offer(current_user_id, offer_id):
    """Resident declines a help offer."""
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Verify that the current user is the owner of the problem
        cur.execute("""
            SELECT p.id, p.user_id 
            FROM problems p 
            JOIN help_offers o ON p.id = o.problem_id 
            WHERE o.id = %s
        """, (str(offer_id),))
        record = cur.fetchone()
        
        if not record or str(record['user_id']) != str(current_user_id):
            return jsonify({"error": "Unauthorized: Only the problem author can decline offers."}), 403

        # Update offer status to declined
        cur.execute("UPDATE help_offers SET status = 'declined' WHERE id = %s", (str(offer_id),))
        conn.commit()
        return jsonify({"message": "Offer declined successfully."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/offers/<uuid:offer_id>/verify-arrival', methods=['POST'])
@token_required
def verify_arrival(current_user_id, offer_id):
    """Helper enters the arrival code provided by the resident to verify physical presence."""
    data = request.get_json(silent=True)
    code_entered = data.get('code')
    
    if not code_entered:
        return jsonify({"error": "Arrival code is required."}), 400

    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # 1. Verify offer and authorization
        cur.execute("""
            SELECT o.helper_id, o.arrival_code, o.status, o.arrival_code_expires_at, o.arrival_code_attempts,
                   p.user_id as resident_id, p.id as problem_id
            FROM help_offers o
            JOIN problems p ON o.problem_id = p.id
            WHERE o.id = %s
        """, (str(offer_id),))
        offer = cur.fetchone()
        
        if not offer:
            return jsonify({"error": "Offer not found."}), 404
        if str(offer['helper_id']) != str(current_user_id):
            return jsonify({"error": "Unauthorized: Only the assigned helper can verify arrival."}), 403
            
        # Check attempts
        attempts = offer.get('arrival_code_attempts') or 0
        if attempts >= 5:
            return jsonify({"error": "Maximum verification attempts (5) exceeded. Please ask the resident to re-generate the code."}), 400
            
        # Check expiry
        expires_at = offer.get('arrival_code_expires_at')
        if expires_at:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
            now = datetime.datetime.now(datetime.timezone.utc)
            if now > expires_at:
                return jsonify({"error": "Arrival code has expired. Please ask the resident to re-generate the code."}), 400
        
        # 2. Match code (hashed match)
        import hashlib
        code_hash = hashlib.sha256(str(code_entered).strip().encode('utf-8')).hexdigest()
        
        if str(offer['arrival_code']) != code_hash:
            # Increment attempts
            new_attempts = attempts + 1
            cur.execute("""
                UPDATE help_offers 
                SET arrival_code_attempts = %s 
                WHERE id = %s
            """, (new_attempts, str(offer_id)))
            conn.commit()
            remaining = 5 - new_attempts
            return jsonify({"error": f"Incorrect arrival code. Attempts remaining: {remaining}."}), 401
        
        # 3. Update status to 'active' (work started)
        cur.execute("""
            UPDATE help_offers 
            SET status = 'active', arrival_verified = TRUE, verified_at = CURRENT_TIMESTAMP 
            WHERE id = %s RETURNING id, status, verified_at
        """, (str(offer_id),))
        res = cur.fetchone()
        if res:
            res['id'] = str(res['id'])
            if res.get('verified_at'): res['verified_at'] = res['verified_at'].isoformat()
        
        conn.commit()

        # Dispatch notification to resident post-commit
        if offer and offer.get('resident_id'):
            try:
                from notification_service import create_and_dispatch_notification
                create_and_dispatch_notification(
                    get_db_conn_fn=get_db_connection,
                    user_id=offer['resident_id'],
                    title="Helper Arrived",
                    body="Arrival code verified. Helper is on site and session is active.",
                    notification_type="arrival_verified",
                    related_id=str(offer_id),
                    idempotency_key=f"arrival_verify_{offer_id}",
                    data={"type": "arrival_verified", "offer_id": str(offer_id), "problem_id": str(offer.get('problem_id'))}
                )
            except Exception as notif_err:
                app.logger.warning("Failed to dispatch arrival notification: %s", notif_err)

        return jsonify({"message": "Physical presence verified. Help session is now active and monitored.", "offer": res}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


def _float_or_none(v, lo, hi):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if lo <= f <= hi else None


@app.route('/api/safety/sos', methods=['POST'])
@app.route('/api/emergency/sos', methods=['POST'])
@limiter.limit("10 per hour")
@token_required
def trigger_sos(current_user_id):
    """Single SOS handler (served on both URLs the app uses).

    1. Records a critical SOS report with the live location (audit trail).
    2. Notifies neighbours inside the sender's own community radius (not every user).
    3. Texts the sender's emergency contacts when an SMS provider is configured; the response says
       honestly how many texts were actually accepted by the provider.
    """
    data = request.get_json(silent=True) or {}
    reason = str(data.get('reason') or 'Emergency SOS Triggered')[:500]
    lat = _float_or_none(data.get('latitude'), -90, 90)
    lng = _float_or_none(data.get('longitude'), -180, 180)

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Service temporarily unavailable"}), 503
    cur = None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT name, latitude, longitude, home_lat, home_lon, COALESCE(community_radius_km, 1) AS radius_km
               FROM users WHERE id = %s AND is_active = TRUE""", (current_user_id,))
        user = cur.fetchone()
        if not user:
            return jsonify({"error": "User not found"}), 404
        if lat is None or lng is None:  # fall back to last known / home location
            lat = user['latitude'] if user['latitude'] is not None else user['home_lat']
            lng = user['longitude'] if user['longitude'] is not None else user['home_lon']

        cur.execute(
            """INSERT INTO reports (reporter_id, reported_user_id, reason, status, report_type, live_location_lat, live_location_lon)
               VALUES (%s, %s, %s, 'critical', 'SOS', %s, %s) RETURNING id""",
            (current_user_id, current_user_id, reason, lat, lng))
        report_id = str(cur.fetchone()['id'])

        neighbors = []
        if user['home_lat'] is not None and user['home_lon'] is not None:
            cur.execute(
                """SELECT u.id FROM users u
                   WHERE u.id <> %(me)s AND u.is_active = TRUE AND u.home_lat IS NOT NULL AND u.home_lon IS NOT NULL
                     AND (6371 * acos(LEAST(1.0, GREATEST(-1.0,
                           cos(radians(%(lat)s)) * cos(radians(u.home_lat)) * cos(radians(u.home_lon) - radians(%(lon)s))
                         + sin(radians(%(lat)s)) * sin(radians(u.home_lat)))))) <= %(radius)s
                     AND NOT EXISTS (SELECT 1 FROM user_blocks b
                                     WHERE (b.blocker_id = %(me)s AND b.blocked_id = u.id)
                                        OR (b.blocker_id = u.id AND b.blocked_id = %(me)s))""",
                {"me": current_user_id, "lat": user['home_lat'], "lon": user['home_lon'], "radius": user['radius_km']})
            neighbors = cur.fetchall()
            for n in neighbors:
                cur.execute("INSERT INTO notifications (user_id, title, body, type) VALUES (%s, %s, %s, %s)",
                            (n['id'], "EMERGENCY SOS", f"{user['name']} pressed the SOS button nearby!", "sos"))

        cur.execute("SELECT name, phone FROM emergency_contacts WHERE user_id = %s", (current_user_id,))
        contacts = cur.fetchall()
        conn.commit()

        # SMS happens after the commit so a slow provider can never lose the SOS record.
        where = f" Location: https://maps.google.com/?q={lat},{lng}" if lat is not None and lng is not None else ""
        sms_sent = 0
        if contacts and otp_service.sms_live():
            for c in contacts:
                try:
                    phone = otp_service.normalize_phone(c['phone'])
                except OtpError:
                    continue
                if otp_service.send_text(phone, f"EMERGENCY SOS: {user['name']} needs help.{where}"):
                    sms_sent += 1
        sms_status = ("no_contacts" if not contacts else "not_configured" if not otp_service.sms_live()
                      else "sent" if sms_sent == len(contacts) else "partial" if sms_sent else "failed")
        return jsonify({
            "message": "SOS recorded. Nearby neighbours have been alerted.",
            "report_id": report_id,
            "neighbors_alerted": len(neighbors),
            "contacts_total": len(contacts),
            "contacts_alerted": sms_sent,
            "sms_status": sms_status,
        }), 201
    except Exception:
        conn.rollback()
        app.logger.exception("SOS failed")
        return jsonify({"error": "Could not send SOS. Please try again or call emergency services."}), 500
    finally:
        if cur:
            cur.close()
        conn.close()

# --- ML / AI Integration (Task 4.1) ---
# Note: Model loading is cached using lru_cache for high-performance requests.
# If the ML model pkl file is retrained or updated, a Flask server restart is
# required to clear the cache and load the new model into memory.
import pickle
from functools import lru_cache

@lru_cache(maxsize=1)
def get_category_model():
    import os
    model_path = 'models/category_model.pkl'
    if os.path.exists(model_path):
        try:
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
                print("ML model loaded successfully")
                return model
        except Exception as e:
            print(f"Error loading category model: {e}")
    else:
        print("Warning: ML model not found. Run train_model.py first.")
    return None

@app.route('/api/ml/analyze', methods=['POST'])
@limiter.limit("30 per hour")
@token_required
def analyze_problem(current_user_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    title = data.get('title', '')
    description = data.get('description', '')
    
    if not description or len(description) < 10:
        return jsonify({"error": "Description too short for analysis"}), 400

    combined_text = f"{title} {description}".strip()

    model = get_category_model()
    if model is None:
        predicted_category = "Tutoring & Tech Help"
        category_proba = 0.85
    else:
        try:
            predicted_category = model.predict([combined_text])[0]
            category_proba = model.predict_proba([combined_text]).max()
        except Exception as e:
            print(f"Prediction error: {e}")
            predicted_category = "Tutoring & Tech Help"
            category_proba = 0.85

    from ml_utils import predict_urgency
    urgency = predict_urgency(combined_text)

    return jsonify({
        "suggested_category": predicted_category,
        "category_confidence": round(category_proba * 100),
        "suggested_urgency": urgency["level"],
        "urgency_confidence": urgency["confidence"]
    }), 200

# --- Relocation Request Endpoints ---
@app.route('/api/users/request-relocation', methods=['POST'])
@token_required
def request_relocation(current_user_id):
    data = request.get_json(silent=True)
    new_lat = data.get('new_lat')
    new_lon = data.get('new_lon')
    reason = data.get('reason', 'Permanently moved')
    
    if new_lat is None or new_lon is None:
        return jsonify({"error": "New coordinates (new_lat/new_lon) are required."}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Check no pending request
        cur.execute("""
            SELECT id FROM relocation_requests
            WHERE user_id = %s AND status = 'pending'
        """, (current_user_id,))
        existing = cur.fetchone()
        
        if existing:
            cur.close()
            conn.close()
            return jsonify({"error": "You already have a pending relocation request"}), 400
            
        new_locality = reverse_geocode(new_lat, new_lon)
        
        cur.execute("""
            INSERT INTO relocation_requests (user_id, new_lat, new_lon, new_locality, reason)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, new_locality
        """, (current_user_id, new_lat, new_lon, new_locality, reason))
        req = cur.fetchone()
        conn.commit()
        
        return jsonify({
            "message": "Request submitted. Usually approved within 24 hours.",
            "new_locality": new_locality,
            "request_id": str(req['id'])
        }), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/admin/relocation/<uuid:request_id>/approve', methods=['POST'])
@token_required
def approve_relocation(current_user_id, request_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verify caller is active
        cur.execute("SELECT role FROM users WHERE id = %s", (current_user_id,))
        user_row = cur.fetchone()
        
        cur.execute("SELECT * FROM relocation_requests WHERE id = %s AND status = 'pending'", (str(request_id),))
        req = cur.fetchone()
        if not req:
            cur.close()
            conn.close()
            return jsonify({"error": "Pending relocation request not found"}), 404
            
        # Update user home settings
        cur.execute("""
            UPDATE users SET
                home_lat = %s,
                home_lon = %s,
                home_locality = %s,
                latitude = %s,
                longitude = %s,
                address = %s
            WHERE id = %s
        """, (
            req['new_lat'], req['new_lon'], req['new_locality'],
            req['new_lat'], req['new_lon'], req['new_locality'],
            str(req['user_id'])
        ))
        
        # Update request status
        cur.execute("""
            UPDATE relocation_requests SET
                status = 'approved',
                reviewed_at = NOW(),
                reviewed_by = %s
            WHERE id = %s
        """, (current_user_id, str(request_id)))
        
        conn.commit()
        return jsonify({"message": "Relocation approved successfully", "new_locality": req['new_locality']}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# --- Confirm / Vote Endpoints ---
@app.route('/api/problems/<uuid:id>/confirm', methods=['POST'])
@token_required
def confirm_problem(current_user_id, id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            INSERT INTO problem_confirmations (problem_id, user_id)
            VALUES (%s, %s)
            ON CONFLICT (problem_id, user_id) DO NOTHING
            RETURNING id
        """, (str(id), current_user_id))
        res = cur.fetchone()
        conn.commit()
        
        cur.execute("SELECT COUNT(*) FROM problem_confirmations WHERE problem_id = %s", (str(id),))
        count = cur.fetchone()['count']
        
        return jsonify({
            "message": "Problem confirmation saved",
            "confirmation_count": count,
            "confirmed": True
        }), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/problems/<uuid:id>/vote', methods=['POST'])
@token_required
def vote_problem(current_user_id, id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            INSERT INTO problem_votes (problem_id, user_id)
            VALUES (%s, %s)
            ON CONFLICT (problem_id, user_id) DO NOTHING
            RETURNING id
        """, (str(id), current_user_id))
        res = cur.fetchone()
        conn.commit()
        
        cur.execute("SELECT COUNT(*) FROM problem_votes WHERE problem_id = %s", (str(id),))
        count = cur.fetchone()['count']
        
        return jsonify({
            "message": "Vote registered",
            "vote_count": count,
            "voted": True
        }), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# --- Community Connections Endpoints ---
@app.route('/api/users/<uuid:target_id>/connect', methods=['POST'])
@token_required
def connect_with_user(current_user_id, target_id):
    problem_id = request.json.get('problem_id')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verify interaction (either they were resident and helper, or vice versa)
        cur.execute("""
            SELECT id, user_id, assigned_helper_id, helper_id 
            FROM problems 
            WHERE id = %s 
              AND (
                (user_id = %s AND (assigned_helper_id = %s OR helper_id = %s))
                OR ((user_id = %s OR assigned_helper_id = %s OR helper_id = %s) AND user_id = %s)
              )
        """, (
            str(problem_id) if problem_id else None,
            current_user_id, str(target_id), str(target_id),
            str(target_id), str(target_id), str(target_id), current_user_id
        ))
        interaction = cur.fetchone()
        
        if not interaction and problem_id:
            cur.execute("""
                SELECT id FROM help_offers
                WHERE problem_id = %s
                  AND ((helper_id = %s AND problem_id IN (SELECT id FROM problems WHERE user_id = %s))
                       OR (helper_id = %s AND problem_id IN (SELECT id FROM problems WHERE user_id = %s)))
            """, (str(problem_id), current_user_id, str(target_id), str(target_id), current_user_id))
            interaction2 = cur.fetchone()
            if not interaction2:
                cur.close()
                conn.close()
                return jsonify({"error": "Can only connect with people you helped or who helped you"}), 403
        
        cur.execute("""
            INSERT INTO community_connections (user_id, connected_to, connected_via_problem)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, connected_to) DO NOTHING
        """, (current_user_id, str(target_id), str(problem_id) if problem_id else None))
        
        cur.execute("""
            INSERT INTO community_connections (user_id, connected_to, connected_via_problem)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, connected_to) DO NOTHING
        """, (str(target_id), current_user_id, str(problem_id) if problem_id else None))
        
        conn.commit()
        return jsonify({"message": "You are now community friends"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/users/connections', methods=['GET'])
@token_required
def get_connections(current_user_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT 
                u.id, u.name as full_name, u.avatar_url,
                u.trust_score, u.home_locality,
                p.title as connected_via,
                cc.created_at as friends_since
            FROM community_connections cc
            JOIN users u ON cc.connected_to = u.id
            LEFT JOIN problems p ON cc.connected_via_problem = p.id
            WHERE cc.user_id = %s
            ORDER BY cc.created_at DESC
        """, (current_user_id,))
        connections = cur.fetchall()
        
        for cc in connections:
            cc['id'] = str(cc['id'])
            if cc['friends_since']:
                cc['friends_since'] = cc['friends_since'].isoformat()
                
        return jsonify({"connections": connections}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# --- User Blocks & Account Deletion ---
@app.route('/api/users/block/<uuid:user_id>', methods=['POST'])
@token_required
def block_user(current_user_id, user_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO user_blocks (blocker_id, blocked_id)
            VALUES (%s, %s)
            ON CONFLICT (blocker_id, blocked_id) DO NOTHING
        """, (current_user_id, str(user_id)))
        conn.commit()
        return jsonify({"message": "User blocked successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/users/blocked', methods=['GET'])
@token_required
def get_blocked_users(current_user_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT u.id, u.name, u.avatar_url
            FROM user_blocks ub
            JOIN users u ON ub.blocked_id = u.id
            WHERE ub.blocker_id = %s
        """, (current_user_id,))
        blocked = cur.fetchall()
        for b in blocked:
            b['id'] = str(b['id'])
        return jsonify({"blocked_users": blocked}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/users/block/<uuid:user_id>', methods=['DELETE'])
@token_required
def unblock_user(current_user_id, user_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            DELETE FROM user_blocks 
            WHERE blocker_id = %s AND blocked_id = %s
        """, (current_user_id, str(user_id)))
        conn.commit()
        return jsonify({"message": "User unblocked successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/users/delete-account', methods=['DELETE'])
@token_required
def delete_account(current_user_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE users SET
                name = 'Deleted User',
                email = %s,
                phone = NULL,
                avatar_url = NULL,
                home_lat = NULL,
                home_lon = NULL,
                home_locality = 'Unknown',
                account_deleted = true,
                deleted_at = NOW(),
                is_active = FALSE
            WHERE id = %s
        """, (f"deleted_{current_user_id}@removed", current_user_id))
        
        cur.execute("""
            DELETE FROM community_connections
            WHERE user_id = %s OR connected_to = %s
        """, (current_user_id, current_user_id))
        
        token = _bearer_token()
        if token:
            try:
                data = decode_access_token(token)
                cur.execute("INSERT INTO token_blacklist (jti, expires_at) VALUES (%s, to_timestamp(%s)) ON CONFLICT DO NOTHING",
                            (data['jti'], data['exp']))
            except jwt.PyJWTError:
                pass
                
        conn.commit()
        return jsonify({"message": "Account deleted. Community history anonymized."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# --- Structured Reviews Endpoints ---
@app.route('/api/problems/<uuid:problem_id>/reviews', methods=['POST'])
@token_required
def submit_structured_review(current_user_id, problem_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON payload"}), 400

    helper_id = data.get('helper_id')
    if not helper_id:
        return jsonify({"error": "helper_id is required"}), 400

    speed = data.get('speed_rating')
    quality = data.get('quality_rating')
    comm = data.get('comm_rating')

    if speed is None or quality is None or comm is None:
        return jsonify({"error": "Missing rating fields"}), 400

    if type(speed) is not int or type(quality) is not int or type(comm) is not int:
        return jsonify({"error": "Ratings must be integers"}), 400

    if not (1 <= speed <= 5 and 1 <= quality <= 5 and 1 <= comm <= 5):
        return jsonify({"error": "Ratings must be between 1 and 5"}), 400

    overall = round((speed + quality + comm) / 3.0)
    photo_url = data.get('resolution_photo_url')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Validate helper exists
        cur.execute("SELECT id FROM users WHERE id = %s", (str(helper_id),))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "Referenced helper does not exist"}), 404

        # Validate problem exists and is owned by the resident, and helper is assigned
        cur.execute("SELECT user_id, assigned_helper_id FROM problems WHERE id = %s", (str(problem_id),))
        prob = cur.fetchone()
        if not prob:
            cur.close()
            conn.close()
            return jsonify({"error": "Problem not found"}), 404
            
        if str(prob['user_id']) != str(current_user_id):
            cur.close()
            conn.close()
            return jsonify({"error": "Unauthorized to review this problem"}), 403
            
        if str(prob['assigned_helper_id']) != str(helper_id):
            cur.close()
            conn.close()
            return jsonify({"error": "Referenced helper is not assigned to this problem"}), 400
            
        cur.execute("""
            INSERT INTO reviews (problem_id, helper_id, resident_id, speed_rating, quality_rating, comm_rating, overall_rating, resolution_photo_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (str(problem_id), str(helper_id), current_user_id, speed, quality, comm, overall, photo_url))
        conn.commit()
        return jsonify({"message": "Review submitted successfully"}), 201
    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        try:
            if 'cur' in locals() and cur is not None:
                cur.close()
        except Exception:
            pass
        if conn is not None:
            conn.close()

# --- Verification Level Auto-Updater ---
def check_and_update_verification(user_id):
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT created_at FROM users WHERE id = %s", (str(user_id),))
        user = cur.fetchone()
        if not user:
            cur.close()
            conn.close()
            return
            
        cur.execute("SELECT COUNT(*) as count FROM problems WHERE resolved_by_helper_id = %s", (str(user_id),))
        helps_count = cur.fetchone()['count']
        
        from datetime import datetime, timezone
        joined = user['created_at']
        if joined:
            delta = datetime.now(timezone.utc) - joined
            account_months = delta.days / 30.0
        else:
            account_months = 0.0
            
        level = 0
        if helps_count >= 10:
            level += 1
        if account_months >= 6:
            level += 2
            
        cur.execute("UPDATE users SET verification_level = %s WHERE id = %s", (level, str(user_id)))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error updating verification level: {e}")


@app.route('/api/emergency/contacts', methods=['GET', 'POST'])
@token_required
def manage_emergency_contacts(current_user_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if request.method == 'GET':
            cur.execute("SELECT id, name, phone FROM emergency_contacts WHERE user_id = %s ORDER BY created_at ASC", (current_user_id,))
            return jsonify(cur.fetchall()), 200
            
        elif request.method == 'POST':
            data = request.get_json(silent=True)
            name = data.get('name')
            phone = data.get('phone')
            if not name or not phone:
                return jsonify({"error": "Name and phone required"}), 400
                
            cur.execute("INSERT INTO emergency_contacts (user_id, name, phone) VALUES (%s, %s, %s) RETURNING id", (current_user_id, name, phone))
            contact_id = cur.fetchone()['id']
            conn.commit()
            return jsonify({"id": contact_id, "name": name, "phone": phone}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/emergency/contacts/<contact_id>', methods=['DELETE'])
@token_required
def delete_emergency_contact(current_user_id, contact_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM emergency_contacts WHERE id = %s AND user_id = %s RETURNING id", (contact_id, current_user_id))
        if not cur.fetchone():
            return jsonify({"error": "Contact not found"}), 404
        conn.commit()
        return jsonify({"message": "Deleted successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# --- In-App Notification Feed & Status Endpoints ---

@app.route('/api/notifications', methods=['GET'])
@token_required
def get_user_notifications(current_user_id):
    """Fetch unread/recent in-app notifications for the authenticated user."""
    try:
        limit = min(int(request.args.get('limit', 50)), 100)
    except (TypeError, ValueError):
        limit = 50
    unread_only = request.args.get('unread_only', 'false').lower() in ('true', '1')

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = """
            SELECT id, title, body, type, related_id, is_read, push_status, created_at
            FROM notifications
            WHERE user_id = %s AND is_active = TRUE
        """
        params = [str(current_user_id)]
        if unread_only:
            query += " AND is_read = FALSE"
        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)

        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        for r in rows:
            r['id'] = str(r['id'])
            if r.get('related_id'):
                r['related_id'] = str(r['related_id'])
            if r.get('created_at'):
                r['created_at'] = r['created_at'].isoformat()

        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/api/notifications/<uuid:notification_id>/read', methods=['PUT'])
@token_required
def mark_notification_read(current_user_id, notification_id):
    """Mark a specific notification as read, enforcing strict user ownership."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE notifications 
            SET is_read = TRUE, updated_at = NOW() 
            WHERE id = %s AND user_id = %s
            RETURNING id
        """, (str(notification_id), str(current_user_id)))
        row = cur.fetchone()
        conn.commit()
        if not row:
            return jsonify({"error": "Notification not found or access denied."}), 404
        return jsonify({"ok": True, "message": "Notification marked as read."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/api/notifications/read-all', methods=['PUT'])
@token_required
def mark_all_notifications_read(current_user_id):
    """Mark all unread notifications as read for authenticated user."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database unavailable"}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE notifications 
            SET is_read = TRUE, updated_at = NOW() 
            WHERE user_id = %s AND is_read = FALSE
        """, (str(current_user_id),))
        conn.commit()
        return jsonify({"ok": True, "message": "All notifications marked as read."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


def admin_or_service_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        import hmac
        service_key = (os.getenv("INTERNAL_SERVICE_KEY") or "").strip()
        req_service_key = request.headers.get("X-Internal-Service-Key")

        # 1. If X-Internal-Service-Key header is supplied, authenticate strictly against INTERNAL_SERVICE_KEY
        if req_service_key is not None:
            clean_req = req_service_key.strip()
            if not clean_req or not service_key or not hmac.compare_digest(service_key, clean_req):
                return jsonify({"error": "Invalid internal service key", "code": "service_key_invalid"}), 401
            return f(current_user_id="service", *args, **kwargs)

        # 2. Check JWT bearer token with admin role
        token = _bearer_token()
        if not token:
            return jsonify({"error": "Authentication or internal service key required", "code": "token_missing"}), 401

        # Check if the bearer token matches the internal service key directly
        if service_key and hmac.compare_digest(service_key, token):
            return f(current_user_id="service", *args, **kwargs)

        try:
            data = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please log in again.", "code": "token_expired"}), 401
        except jwt.PyJWTError:
            return jsonify({"error": "Invalid authentication token", "code": "token_invalid"}), 401

        user_id = data.get('user_id')
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Service temporarily unavailable", "code": "auth_unavailable"}), 503

        try:
            cur = conn.cursor()
            cur.execute("SELECT role, is_active FROM users WHERE id = %s", (str(user_id),))
            user_row = cur.fetchone()
            cur.close()
        except Exception:
            return jsonify({"error": "Service temporarily unavailable", "code": "auth_unavailable"}), 503
        finally:
            conn.close()

        if not user_row or not user_row[1]:
            return jsonify({"error": "Account disabled or not found", "code": "account_disabled"}), 403

        user_role = user_row[0]
        if user_role != 'admin':
            return jsonify({"error": "Forbidden: Administrator privileges required.", "code": "forbidden"}), 403

        return f(current_user_id=str(user_id), *args, **kwargs)
    return decorated


@app.route('/api/internal/push-recovery', methods=['POST'])
@admin_or_service_required
def trigger_push_recovery(current_user_id):
    """Trigger pending push recovery on demand (requires admin privileges or internal service key)."""
    try:
        import notification_service
        recovered = notification_service.process_pending_pushes(get_db_connection)
        return jsonify({"ok": True, "recovered": recovered}), 200
    except Exception as e:
        app.logger.exception("Failed to run push recovery: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500


# Graceful shutdown handling (compatible with Gunicorn and standalone processes)
import atexit
import signal
import sys

def _stop_worker_gracefully(*args, **kwargs):
    try:
        import notification_service
        notification_service.stop_background_recovery_worker(get_db_connection)
    except Exception as _stop_err:
        app.logger.warning("Error stopping background recovery worker: %s", _stop_err)

_handle_shutdown_signal = _stop_worker_gracefully
atexit.register(_stop_worker_gracefully)

def _chain_signal_handler(signum):
    """Chain custom cleanup without overriding or breaking Gunicorn's worker shutdown handler."""
    try:
        prev_handler = signal.getsignal(signum)
        def _handler(sig, frame):
            _stop_worker_gracefully()
            if callable(prev_handler):
                prev_handler(sig, frame)
            elif prev_handler == signal.SIG_DFL:
                sys.exit(0)
        signal.signal(signum, _handler)
    except (ValueError, AttributeError):
        pass

_chain_signal_handler(signal.SIGTERM)
_chain_signal_handler(signal.SIGINT)


def _should_start_push_worker() -> bool:
    """Determine whether to start background push recovery thread in this process.
    
    In testing: always False.
    If explicitly set via ENABLE_PUSH_WORKER: respect boolean flag.
    In production: default to False to prevent duplicate workers across multi-process WSGI (Gunicorn).
    In development: default to True for standalone local server convenience.
    """
    if os.getenv("APP_ENV") == "testing":
        return False
    val = os.getenv("ENABLE_PUSH_WORKER")
    if val is not None:
        return val.strip().lower() in ("true", "1", "yes")
    return not otp_service.is_production()


if _should_start_push_worker():
    try:
        import notification_service
        notification_service.start_background_recovery_worker(get_db_connection, interval_seconds=60)
    except Exception as _worker_err:
        app.logger.warning("Could not start background push recovery worker: %s", _worker_err)




if __name__ == '__main__':
    # Development server only.  In production run:  gunicorn -w 2 -b 0.0.0.0:$PORT app:app
    port = int(os.environ.get('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', '0') == '1' and not otp_service.is_production()
    app.run(host=os.getenv('HOST', '127.0.0.1'), port=port, debug=debug)










