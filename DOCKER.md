# Docker Configuration for Origin Food House Backend

This document explains how to run the Origin Food House Backend using Docker.

## Quick Start

### Development Environment

```bash
# Start development environment with hot reload
./docker.sh dev

# Or manually:
docker-compose -f docker-compose.dev.yml up --build
```

### Production Environment

```bash
# Start production environment
./docker.sh prod

# Or manually:
docker-compose up --build
```

## Docker Management Script

Use the included `docker.sh` script for easy container management:

```bash
./docker.sh dev      # Start development environment
./docker.sh prod     # Start production environment
./docker.sh build    # Build production image
./docker.sh up       # Start services
./docker.sh down     # Stop services
./docker.sh logs     # Show logs
./docker.sh clean    # Clean all containers and volumes
./docker.sh seed     # Run database seeding
./docker.sh migrate  # Run database migrations
./docker.sh shell    # Access container shell
```

## Services

The Docker setup includes:

- **PostgreSQL**: Database server (port 5432)
- **Backend API**: NestJS application (port 3000)

## Environment Variables

Copy the example environment file and customize:

```bash
cp .env.example .env
```

Key environment variables:

| Variable             | Description                  | Default                                             |
| -------------------- | ---------------------------- | --------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string | `postgresql://myuser:mypassword@postgres:5432/mydb` |
| `JWT_SECRET`         | JWT signing secret           | Required                                            |
| `JWT_REFRESH_SECRET` | JWT refresh token secret     | Required                                            |
| `NODE_ENV`           | Environment mode             | `production`                                        |
| `PORT`               | Application port             | `3000`                                              |
| `CORS_ORIGIN`        | Allowed CORS origins         | `http://localhost:3001,http://localhost:3002`       |

## File Structure

```
├── Dockerfile              # Production Dockerfile
├── Dockerfile.dev          # Development Dockerfile
├── docker-compose.yml      # Production Docker Compose
├── docker-compose.dev.yml  # Development Docker Compose
├── docker-entrypoint.sh    # Container startup script
├── docker.sh               # Management script
├── .dockerignore           # Docker build context exclusions
└── .env.example            # Environment variables template
```

## Development Workflow

1. **Start development environment:**

   ```bash
   ./docker.sh dev
   ```

2. **View logs:**

   ```bash
   ./docker.sh logs
   ```

3. **Run database migrations:**

   ```bash
   ./docker.sh migrate
   ```

4. **Seed database:**

   ```bash
   ./docker.sh seed
   ```

5. **Access container shell:**
   ```bash
   ./docker.sh shell
   ```

## Production Deployment

1. **Build production image:**

   ```bash
   ./docker.sh build
   ```

2. **Start production environment:**

   ```bash
   ./docker.sh prod
   ```

3. **Configure environment variables** in `docker-compose.yml` or via external `.env` file

## Database Management

The Docker setup automatically handles:

- Database creation
- Schema migrations
- Connection health checks

For manual database operations:

```bash
# Run migrations
docker-compose exec app npx prisma migrate deploy

# Seed database
docker-compose exec app npx prisma db seed

# Access Prisma Studio
docker-compose exec app npx prisma studio
```

## Volumes

- `postgres-data`: Persistent PostgreSQL data
- `app-uploads`: Application file uploads (optional)

## Network

All services run on the default Docker network with internal DNS resolution:

- `postgres`: Database service
- `app`: Application service

## Troubleshooting

### Common Issues

1. **Port conflicts:**

   ```bash
   # Stop existing services
   ./docker.sh down

   # Or change ports in docker-compose.yml
   ```

2. **Database connection issues:**

   ```bash
   # Check database health
   docker-compose exec postgres pg_isready -U myuser -d mydb
   ```

3. **Permission issues:**

   ```bash
   # Ensure scripts are executable
   chmod +x docker.sh docker-entrypoint.sh
   ```

4. **Clean start:**
   ```bash
   # Remove all containers and start fresh
   ./docker.sh clean
   ./docker.sh dev
   ```

### Logs

View detailed logs:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres
```

## Health Checks

The setup includes health checks for:

- PostgreSQL database connectivity
- Application startup dependencies

## Security Considerations

For production deployment:

1. Change default database credentials
2. Use strong JWT secrets
3. Configure proper CORS origins
4. Set up SSL/TLS termination
5. Use Docker secrets for sensitive data
6. Run with non-root user (configured by default)

## Integration with CI/CD

Example GitHub Actions workflow:

```yaml
name: Build and Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and test
        run: |
          ./docker.sh build
          ./docker.sh dev
          # Run tests here
```
