#!/usr/bin/env bash
# =============================================================================
# MIKAPEDIA TOMS — Production Deployment Script
# =============================================================================
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh              # Full deploy (build + migrate + start)
#   ./deploy.sh --restart    # Restart without rebuilding
#   ./deploy.sh --logs       # View logs
#   ./deploy.sh --stop       # Stop all services
#   ./deploy.sh --status     # Check service status
# =============================================================================

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="mikapedia-toms"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── Pre-flight checks ───────────────────────────────────────────────────────
preflight() {
    log "Running pre-flight checks..."

    command -v docker >/dev/null 2>&1 || error "Docker is not installed"
    command -v docker compose >/dev/null 2>&1 || error "Docker Compose V2 is not installed"

    if [ ! -f "backend/.env" ]; then
        error "backend/.env not found! Copy backend/.env.production to backend/.env and fill in values."
    fi

    # Check for placeholder values
    if grep -q "CHANGE-ME" backend/.env 2>/dev/null; then
        warn "backend/.env contains CHANGE-ME placeholders. Please update before production use!"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        [[ $REPLY =~ ^[Yy]$ ]] || exit 1
    fi

    success "Pre-flight checks passed"
}

# ── Build ────────────────────────────────────────────────────────────────────
build() {
    log "Building Docker images..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build --parallel
    success "Images built successfully"
}

# ── Database migration ───────────────────────────────────────────────────────
migrate() {
    log "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" run --rm \
        backend python manage.py migrate --noinput
    success "Migrations complete"
}

# ── Collect static files ─────────────────────────────────────────────────────
collectstatic() {
    log "Collecting static files..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" run --rm \
        backend python manage.py collectstatic --noinput
    success "Static files collected"
}

# ── Create superuser ─────────────────────────────────────────────────────────
create_superuser() {
    log "Creating superuser (optional)..."
    echo ""
    read -p "Create a superuser? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" run --rm \
            backend python manage.py createsuperuser
        success "Superuser created"
    else
        log "Skipping superuser creation"
    fi
}

# ── Start services ───────────────────────────────────────────────────────────
start() {
    log "Starting all services..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    success "All services started!"
    echo ""
    status
}

# ── Stop services ────────────────────────────────────────────────────────────
stop() {
    log "Stopping all services..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    success "All services stopped"
}

# ── Show status ──────────────────────────────────────────────────────────────
status() {
    log "Service status:"
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
}

# ── Show logs ────────────────────────────────────────────────────────────────
show_logs() {
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f --tail=100
}

# ── Full deploy ──────────────────────────────────────────────────────────────
full_deploy() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   MIKAPEDIA TOMS — Production Deployment     ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
    echo ""

    preflight
    build
    start

    # Wait for DB to be ready
    log "Waiting for database to be ready..."
    sleep 5

    migrate
    collectstatic
    create_superuser

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   🚀 Deployment complete!                    ║${NC}"
    echo -e "${GREEN}║                                              ║${NC}"
    echo -e "${GREEN}║   Frontend:  http://YOUR_SERVER_IP           ║${NC}"
    echo -e "${GREEN}║   API:       http://YOUR_SERVER_IP/api/      ║${NC}"
    echo -e "${GREEN}║   Admin:     http://YOUR_SERVER_IP/admin/    ║${NC}"
    echo -e "${GREEN}║   WebSocket: ws://YOUR_SERVER_IP/ws/live/    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
case "${1:-}" in
    --restart)
        stop
        start
        ;;
    --logs)
        show_logs
        ;;
    --stop)
        stop
        ;;
    --status)
        status
        ;;
    --build)
        build
        ;;
    --migrate)
        migrate
        ;;
    *)
        full_deploy
        ;;
esac
