# ── Stage 1: Build dependencies ──────────────────────────────────────────────
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# MetaTrader5 is Windows-only; strip it from requirements on Linux builds.
RUN grep -vi 'MetaTrader5' requirements.txt > requirements_linux.txt \
    && pip install --no-cache-dir --prefix=/install -r requirements_linux.txt

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Create required directories
RUN mkdir -p /app/staticfiles /app/media \
    && chown -R appuser:appuser /app

# Collect static files (runs with DEBUG=False via env)
RUN SECRET_KEY=build-placeholder \
    DEBUG=False \
    DB_ENGINE=django.db.backends.sqlite3 \
    DB_NAME=:memory: \
    python manage.py collectstatic --noinput 2>/dev/null || true

USER appuser

EXPOSE 8000

# Daphne (ASGI) serves both HTTP and WebSocket
CMD ["daphne", \
     "-b", "0.0.0.0", \
     "-p", "8000", \
     "--proxy-headers", \
     "config.asgi:application"]
