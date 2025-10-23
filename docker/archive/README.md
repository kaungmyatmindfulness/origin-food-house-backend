# Archived Docker Configurations

This directory contains the old Docker configuration files from when the application was fully containerized for local development.

## What Changed (January 2025)

We simplified the Docker strategy for local development:

**OLD APPROACH** (Archived):
- Full containerization with `docker-compose.dev.yml`
- Both app and database ran in Docker containers
- Required `Dockerfile.dev` and `docker-entrypoint.sh`
- Slower hot reload, volume mounting complexity

**NEW APPROACH** (Current):
- Docker provides ONLY infrastructure services (PostgreSQL, pgAdmin)
- Application runs natively on host machine
- Simpler, faster developer experience
- Better debugging and IDE integration

## Archived Files

- `docker-compose.dev.yml` - Old development compose file (app + services)
- `Dockerfile.dev` - Old development Dockerfile
- `docker-entrypoint.sh` - Old entrypoint script for migrations

## Production Deployment

For production deployment, we still use:
- `Dockerfile` (multi-stage production build) - Located in project root
- Can be deployed to any container platform (AWS ECS, Kubernetes, etc.)

## Why Keep These Files?

These files are archived for reference in case:
1. You need to fully containerize the app for a specific environment
2. You want to understand the previous Docker strategy
3. You need to deploy to an environment that requires full containerization

## Restoring Old Approach

If you need to use the old fully-containerized approach:

1. Copy files back to project root:
   ```bash
   cp docker/archive/docker-compose.dev.yml ./
   cp docker/archive/Dockerfile.dev ./
   cp docker/archive/docker-entrypoint.sh ./
   ```

2. Start with:
   ```bash
   docker compose -f docker-compose.dev.yml up
   ```

## Questions?

See the main README.md for the current development setup instructions.
