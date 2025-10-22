#!/bin/sh
set -e

# Colors for output (if terminal supports it)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
log_info() {
  echo "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo "${RED}[ERROR]${NC} $1"
}

# Extract database host from DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

log_info "Waiting for database at ${DB_HOST}:${DB_PORT} to be ready..."

# Wait for PostgreSQL to be ready with timeout
MAX_TRIES=30
TRIES=0
until pg_isready -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} > /dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ $TRIES -eq $MAX_TRIES ]; then
    log_error "Database is not ready after ${MAX_TRIES} attempts. Exiting..."
    exit 1
  fi
  log_info "Database is unavailable - sleeping (attempt ${TRIES}/${MAX_TRIES})"
  sleep 2
done

log_success "Database is ready!"

# Generate Prisma Client (in case it's not already generated)
log_info "Generating Prisma Client..."
npx prisma generate || {
  log_error "Failed to generate Prisma Client"
  exit 1
}

# Run migrations
log_info "Running database migrations..."
if npx prisma migrate deploy; then
  log_success "Database migrations completed successfully"
else
  log_error "Database migrations failed"
  exit 1
fi

# Optionally seed the database in development
if [ "$NODE_ENV" = "dev" ] || [ "$NODE_ENV" = "development" ]; then
  log_info "Running database seeding for development environment..."
  if npm run seed:db 2>/dev/null; then
    log_success "Database seeding completed"
  else
    log_warning "Seeding failed or no seed script available - continuing anyway"
  fi
fi

log_success "Database initialization completed!"
log_info "Starting application..."
echo ""

# Execute the main command
exec "$@"
