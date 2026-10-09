"""Shared Flask extensions (kept out of app.py to avoid circular imports with blueprints)."""
import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Use RATELIMIT_STORAGE_URI=redis://... in production when running more than one worker;
# the in-memory default only limits per process.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
)
