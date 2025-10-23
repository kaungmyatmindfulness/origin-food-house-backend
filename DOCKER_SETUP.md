# Docker Setup - Quick Reference Guide

## Overview

**New Approach (January 2025):** Docker provides ONLY infrastructure services for local development.

### What Changed

| Aspect | Old Approach | New Approach |
|--------|--------------|--------------|
| **Application** | Runs in Docker container | Runs natively on host machine |
| **Database** | Docker container | Docker container |
| **Hot Reload** | Slower (volume mounting) | Faster (native) |
| **Debugging** | More complex | Native IDE integration |
| **Setup** | `docker compose up` | `npm run docker:up && npm run dev` |

## Quick Start

```bash
# 1. Start infrastructure services
npm run docker:up

# 2. Run the application natively
npm run dev
```

## Available Commands

### Docker Services

```bash
npm run docker:up        # Start PostgreSQL
npm run docker:down      # Stop all services
npm run docker:logs      # View service logs
npm run docker:ps        # Check service status
npm run docker:clean     # Stop and remove volumes (⚠️ deletes data)
```

### Application Development

```bash
npm run dev              # Start development server
npm run build            # Build application
npm run test             # Run tests
npm run lint             # Lint code
```

### Database Management

```bash
npm run migrate:db       # Run Prisma migrations
npm run generate:db      # Generate Prisma client
npm run studio:db        # Open Prisma Studio
npm run seed:db          # Seed database
npm run reset:db         # Reset database (⚠️ destructive)
```

## Services Provided

### PostgreSQL Database
- **Container Name:** `origin-food-house-postgres`
- **Port:** `5432`
- **Connection:** `postgresql://myuser:mypassword@localhost:5432/mydb`
- **Health Check:** Included
- **Data Persistence:** Docker volume

### Database Management

Use Prisma Studio or any PostgreSQL client:
- **Prisma Studio:** `npm run studio:db`
- **Desktop Tools:** TablePlus, DBeaver, pgAdmin (connect to `localhost:5432`)

## Typical Development Workflow

```bash
# Morning: Start your day
npm run docker:up        # Start PostgreSQL
npm run dev              # Start development server

# During development
npm run test:watch       # Run tests in watch mode
npm run lint             # Check code quality

# End of day
npm run docker:down      # Stop Docker services
# Ctrl+C on dev server
```

## Environment Configuration

The application connects to Docker services via `localhost`:

```env
# .env file
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb"
POSTGRES_USER="myuser"
POSTGRES_PASSWORD="mypassword"
POSTGRES_DB="mydb"
POSTGRES_PORT=5432
```

## Troubleshooting

### PostgreSQL won't start
```bash
# Check if port 5432 is already in use
lsof -i :5432

# Clean up and restart
npm run docker:clean
npm run docker:up
```

### Can't connect to database
```bash
# Verify PostgreSQL is running and healthy
npm run docker:ps

# Check logs
npm run docker:logs

# Verify connection from host
docker exec origin-food-house-postgres pg_isready -U myuser -d mydb
```

### Old containers still running
```bash
# Clean up old containers
docker compose down --remove-orphans

# Start fresh
npm run docker:up
```

## Production Deployment

For production, use the `Dockerfile` in the project root:

```bash
# Build production image
docker build -t origin-food-house-backend .

# The docker-compose.yml is for local development services only
# Create a separate docker-compose.prod.yml for production deployment
```

## Archived Configurations

Old Docker configurations (when app ran in containers) are archived in `docker/archive/` for reference.

## Additional Resources

- **Main README:** `./README.md`
- **Development Guide:** `./CLAUDE.md`
- **Project Guide:** `../CLAUDE.md`
- **Environment Template:** `.env.example`

## Benefits of This Approach

✅ **Faster Development**
- No container overhead
- Native hot reload
- Instant code changes

✅ **Better Debugging**
- Full IDE integration
- Native Node.js debugging
- Easier breakpoint management

✅ **Simpler Setup**
- No Docker knowledge required for app development
- Clear separation: Docker for services, native for app
- Easier troubleshooting

✅ **Flexible**
- Use any Node.js version on your machine
- Easy to switch between projects
- No volume mounting issues

## Migration from Old Setup

If you were using the old fully-containerized setup:

1. **Stop old containers:**
   ```bash
   docker compose -f docker-compose.dev.yml down -v
   ```

2. **Install dependencies locally:**
   ```bash
   npm install
   ```

3. **Start new setup:**
   ```bash
   npm run docker:up
   npm run dev
   ```

4. **Update .env:**
   - Change `@postgres` to `@localhost` in `DATABASE_URL`

## Questions?

See the main `README.md` or `CLAUDE.md` for detailed documentation.
