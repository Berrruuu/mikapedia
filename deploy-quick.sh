#!/bin/bash
# Quick Deploy Script for MIKAPEDIA TOMS
# Run this script on your VPS after initial setup

set -e

echo "🚀 MIKAPEDIA TOMS - Quick Deploy Script"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/mika-ops-hub"
COMPOSE_FILE="docker-compose.prod.yml"

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
  DOCKER_CMD="docker"
  DOCKER_COMPOSE_CMD="docker compose"
else
  DOCKER_CMD="sudo docker"
  DOCKER_COMPOSE_CMD="sudo docker compose"
fi

# Function to print colored messages
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
  print_error "Project directory not found: $PROJECT_DIR"
  exit 1
fi

cd $PROJECT_DIR

# Menu
echo ""
echo "What do you want to do?"
echo "1) First time deploy (build & start)"
echo "2) Update & redeploy (pull, rebuild, restart)"
echo "3) Restart services"
echo "4) Stop all services"
echo "5) View logs"
echo "6) Run migrations"
echo "7) Create superuser"
echo "8) Backup database"
echo "9) Check status"
echo "0) Exit"
echo ""
read -p "Enter your choice [0-9]: " choice

case $choice in
  1)
    print_info "Starting first time deployment..."
    
    # Check if .env exists
    if [ ! -f "backend/.env" ]; then
      print_warning "backend/.env not found!"
      read -p "Do you want to copy from .env.production? (y/n): " copy_env
      if [ "$copy_env" = "y" ]; then
        cp backend/.env.production backend/.env
        print_success "Copied backend/.env.production to backend/.env"
        print_warning "Please edit backend/.env with your configuration!"
        print_info "Run: nano backend/.env"
        exit 0
      else
        print_error "Please create backend/.env first"
        exit 1
      fi
    fi
    
    print_info "Building Docker images..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE build --no-cache
    
    print_info "Starting services..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE up -d
    
    print_info "Waiting for services to be ready..."
    sleep 10
    
    print_info "Running migrations..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE exec backend python manage.py migrate
    
    print_info "Collecting static files..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE exec backend python manage.py collectstatic --noinput
    
    print_success "Deployment completed!"
    print_info "Next steps:"
    echo "  1. Create superuser: ./deploy-quick.sh (choose option 7)"
    echo "  2. Visit your website: https://your-domain.com"
    ;;
    
  2)
    print_info "Updating and redeploying..."
    
    # Check if git repo
    if [ -d ".git" ]; then
      print_info "Pulling latest changes from git..."
      git pull origin main
    else
      print_warning "Not a git repository. Skipping git pull."
    fi
    
    print_info "Stopping services..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE down
    
    print_info "Rebuilding images..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE build --no-cache
    
    print_info "Starting services..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE up -d
    
    print_info "Waiting for services to be ready..."
    sleep 10
    
    print_info "Running migrations..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE exec backend python manage.py migrate
    
    print_info "Collecting static files..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE exec backend python manage.py collectstatic --noinput
    
    print_success "Update completed!"
    ;;
    
  3)
    print_info "Restarting services..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE restart
    print_success "Services restarted!"
    ;;
    
  4)
    print_warning "Stopping all services..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE down
    print_success "All services stopped!"
    ;;
    
  5)
    echo "Which service logs do you want to view?"
    echo "1) All services"
    echo "2) Backend"
    echo "3) Frontend"
    echo "4) Nginx"
    echo "5) Database"
    echo "6) Redis"
    echo "7) Celery Worker"
    echo "8) Celery Beat"
    read -p "Enter your choice [1-8]: " log_choice
    
    case $log_choice in
      1) $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f ;;
      2) $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f backend ;;
      3) $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f frontend ;;
      4) $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f nginx ;;
      5) $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f db ;;
      6) $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f redis ;;
      7) $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f celery-worker ;;
      8) $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f celery-beat ;;
      *) print_error "Invalid choice" ;;
    esac
    ;;
    
  6)
    print_info "Running database migrations..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE exec backend python manage.py migrate
    print_success "Migrations completed!"
    ;;
    
  7)
    print_info "Creating superuser..."
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE exec backend python manage.py createsuperuser
    print_success "Superuser created!"
    ;;
    
  8)
    print_info "Creating database backup..."
    BACKUP_DIR="$PROJECT_DIR/backups"
    mkdir -p $BACKUP_DIR
    BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE exec -T db pg_dump -U mikapedia mikapedia_toms > $BACKUP_FILE
    
    if [ -f "$BACKUP_FILE" ]; then
      print_success "Database backup created: $BACKUP_FILE"
    else
      print_error "Backup failed!"
    fi
    ;;
    
  9)
    print_info "Checking services status..."
    echo ""
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE ps
    echo ""
    
    print_info "Checking resource usage..."
    $DOCKER_CMD stats --no-stream
    echo ""
    
    print_info "Checking disk usage..."
    df -h
    echo ""
    
    # Test website
    print_info "Testing website..."
    if command -v curl &> /dev/null; then
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null || echo "000")
      if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "200" ]; then
        print_success "Website is responding (HTTP $HTTP_CODE)"
      else
        print_warning "Website HTTP code: $HTTP_CODE"
      fi
    fi
    ;;
    
  0)
    print_info "Exiting..."
    exit 0
    ;;
    
  *)
    print_error "Invalid choice"
    exit 1
    ;;
esac

echo ""
print_success "Done!"
