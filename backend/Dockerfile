# ==============================================================================
# SAMANVI Backend Production Containerfile
# Base: Official Python 3.11 Debian Slim runtime
# ==============================================================================
FROM python:3.11-slim AS runtime

# Prevent Python from writing .pyc files and enable unbuffered standard I/O
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000 \
    APP_ENV=production \
    PYTHONPATH=/app

# Install system dependencies required for PostgreSQL (libpq) and curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged application user and group
RUN groupadd -g 10001 samanvi && \
    useradd -u 10001 -g samanvi -s /bin/bash -m samanvi

WORKDIR /app

# Install dependencies in a separate layer for build caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source code
COPY . .

# Ensure upload and static directories exist and have proper ownership
RUN mkdir -p static/uploads/avatars static/uploads/problems && \
    chown -R samanvi:samanvi /app

# Switch to unprivileged user
USER samanvi:samanvi

# Expose default application port
EXPOSE 5000

# Container liveness probe using native /health endpoint (curl with Python urllib fallback)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:5000/health', timeout=3).getcode() == 200 else 1)" || exit 1

# Production WSGI server (Gunicorn) with multi-worker concurrency
# Web workers run with ENABLE_PUSH_WORKER=false by default; background recovery runs in dedicated worker
CMD ["gunicorn", "--workers", "2", "--bind", "0.0.0.0:5000", "--access-logfile", "-", "--error-logfile", "-", "--timeout", "60", "--graceful-timeout", "30", "app:app"]
