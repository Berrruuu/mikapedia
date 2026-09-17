#!/bin/bash

# ============================================================================
# MIKAPEDIA TOMS - VPS Update Script
# ============================================================================
# Script untuk update sistem di VPS dengan aman
# Usage: ./update-vps.sh [options]
# Options:
#   --full      : Full rebuild semua container
#   --frontend  : Update frontend only (default)
#   --backend   : Update backend only
#   --no-backup : Skip database backup
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
UPDATE_TYPE="frontend"
DO_BACKUP=true
COMPOSE_FILE="docker-compose.prod.yml"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --full)
      UPDATE_TYPE="full"
      shift
      ;;
    --frontend)
      UPDATE_TYPE="frontend"
      shift
      ;;
    --backend)
      UPDATE_TYPE="backend"
      shift
      ;;
    --no-backup)
      DO_BACKUP=false
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Functions
print_header() {
  echo -e "\n${BLUE}════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# Main script
print_header "MIKAPEDIA TOMS - VPS Update"

# Check if docker-compose exists
if [ ! -f "$COMPOSE_FILE" ]; then
  print_error "File $COMPOSE_FILE tidak ditemukan!"
  print_info "Pastikan Anda berada di direktori project yang benar"
  exit 1
fi

# Step 1: Backup Database (if enabled)
if [ "$DO_BACKUP" = true ]; then
  print_header "Step 1: Backup Database"
  
  BACKUP_DIR="backups"
  mkdir -p "$BACKUP_DIR"
  
  BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"
  
  print_info "Creating database backup..."
  if docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U mikapedia mikapedia_toms > "$BACKUP_FILE" 2>/dev/null; then
    print_success "Database backup created: $BACKUP_FILE"
  else
    print_warning "Database backup failed (continuing anyway...)"
  fi
else
  print_warning "Skipping database backup (--no-backup specified)"
fi

# Step 2: Check current status
print_header "Step 2: Current Status"
docker compose -f "$COMPOSE_FILE" ps

# Step 3: Pull latest code
print_header "Step 3: Pull Latest Code"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
print_info "Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  print_warning "You have uncommitted changes:"
  git status -s
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Update cancelled"
    exit 1
  fi
fi

print_info "Pulling latest changes..."
git pull origin "$CURRENT_BRANCH"

# Show latest commits
print_info "Latest commits:"
git log --oneline -3

# Step 4: Update containers based on type
print_header "Step 4: Update Containers ($UPDATE_TYPE)"

case $UPDATE_TYPE in
  frontend)
    print_info "Building frontend container..."
    docker compose -f "$COMPOSE_FILE" build frontend
    
    print_info "Restarting frontend..."
    docker compose -f "$COMPOSE_FILE" up -d frontend
    
    print_success "Frontend updated successfully"
    ;;
    
  backend)
    print_info "Building backend container..."
    docker compose -f "$COMPOSE_FILE" build backend
    
    print_info "Restarting backend services..."
    docker compose -f "$COMPOSE_FILE" restart backend celery-worker celery-beat
    
    print_success "Backend updated successfully"
    ;;
    
  full)
    print_info "Building all containers..."
    docker compose -f "$COMPOSE_FILE" build
    
    print_info "Restarting all services..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    print_success "All services updated successfully"
    ;;
esac

# Step 5: Wait for containers to be healthy
print_header "Step 5: Health Check"

print_info "Waiting for containers to be healthy..."
sleep 5

# Check container status
docker compose -f "$COMPOSE_FILE" ps

# Step 6: Verify logs
print_header "Step 6: Verify Logs"

case $UPDATE_TYPE in
  frontend)
    print_info "Showing frontend logs (last 20 lines)..."
    docker compose -f "$COMPOSE_FILE" logs --tail=20 frontend
    ;;
  backend)
    print_info "Showing backend logs (last 20 lines)..."
    docker compose -f "$COMPOSE_FILE" logs --tail=20 backend
    ;;
  full)
    print_info "Showing all logs (last 10 lines each)..."
    docker compose -f "$COMPOSE_FILE" logs --tail=10
    ;;
esac

# Step 7: Cleanup
print_header "Step 7: Cleanup"

print_info "Removing unused Docker images..."
docker image prune -f > /dev/null 2>&1

print_success "Cleanup completed"

# Final summary
print_header "Update Summary"

echo -e "${GREEN}✓ Update completed successfully!${NC}\n"

print_info "Updated: $UPDATE_TYPE"
print_info "Branch: $CURRENT_BRANCH"
print_info "Commit: $(git log --oneline -1)"

if [ "$DO_BACKUP" = true ] && [ -f "$BACKUP_FILE" ]; then
  print_info "Backup: $BACKUP_FILE"
fi

echo ""
print_warning "Don't forget to:"
echo "  1. Clear browser cache (Ctrl+Shift+R)"
echo "  2. Test the application"
echo "  3. Monitor logs: docker compose -f $COMPOSE_FILE logs -f"

echo ""
print_success "Done! 🎉"
