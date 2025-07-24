#!/bin/bash

# Docker management script for Origin Food House Backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
show_usage() {
    echo "Usage: $0 {dev|prod|build|up|down|logs|clean|seed|migrate|shell}"
    echo ""
    echo "Commands:"
    echo "  dev      - Start development environment with hot reload"
    echo "  prod     - Start production environment"
    echo "  build    - Build production Docker image"
    echo "  up       - Start services (default: production)"
    echo "  down     - Stop and remove containers"
    echo "  logs     - Show application logs"
    echo "  clean    - Remove all containers, images, and volumes"
    echo "  seed     - Run database seeding"
    echo "  migrate  - Run database migrations"
    echo "  shell    - Access application container shell"
    echo ""
}

# Start development environment
start_dev() {
    print_status "Starting development environment..."
    docker-compose -f docker-compose.dev.yml up --build -d
    print_success "Development environment started!"
    print_status "Application will be available at: http://localhost:3000"
    print_status "API docs will be available at: http://localhost:3000/api-docs"
}

# Start production environment
start_prod() {
    print_status "Starting production environment..."
    docker-compose up --build -d
    print_success "Production environment started!"
    print_status "Application available at: http://localhost:3000"
}

# Build production image
build_prod() {
    print_status "Building production Docker image..."
    docker build -t origin-food-house-backend .
    print_success "Production image built successfully!"
}

# Start services
start_services() {
    print_status "Starting services..."
    docker-compose up -d
    print_success "Services started!"
}

# Stop services
stop_services() {
    print_status "Stopping services..."
    docker-compose down
    docker-compose -f docker-compose.dev.yml down
    print_success "Services stopped!"
}

# Show logs
show_logs() {
    print_status "Showing application logs..."
    docker-compose logs -f app
}

# Clean everything
clean_all() {
    print_warning "This will remove all containers, images, and volumes!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up..."
        docker-compose down -v --remove-orphans
        docker-compose -f docker-compose.dev.yml down -v --remove-orphans
        docker system prune -af --volumes
        print_success "Cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Run database seeding
run_seed() {
    print_status "Running database seeding..."
    docker-compose exec app npx prisma db seed
    print_success "Database seeding completed!"
}

# Run database migrations
run_migrate() {
    print_status "Running database migrations..."
    docker-compose exec app npx prisma migrate deploy
    print_success "Database migrations completed!"
}

# Access container shell
access_shell() {
    print_status "Accessing application container shell..."
    docker-compose exec app sh
}

# Main script logic
case "${1:-help}" in
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    build)
        build_prod
        ;;
    up)
        start_services
        ;;
    down)
        stop_services
        ;;
    logs)
        show_logs
        ;;
    clean)
        clean_all
        ;;
    seed)
        run_seed
        ;;
    migrate)
        run_migrate
        ;;
    shell)
        access_shell
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac
