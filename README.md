# Origin Food House - Backend

NestJS-based REST API for the Origin Food House restaurant management platform.

## Table of Contents

- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Docker Services](#docker-services)
- [Database Management](#database-management)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start database service (PostgreSQL via Docker)
npm run docker:up

# 4. Run database migrations
npm run migrate:db

# 5. Generate Prisma client
npm run generate:db

# 6. Seed database with demo data
npm run seed:db

# 7. Start development server
npm run dev
```

The API will be available at `http://localhost:3000`

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for database services)
- PostgreSQL client tools (optional, for CLI access)

### Local Development Philosophy

This project follows a **hybrid approach** for local development:

- **Application**: Runs natively on your machine for fast development
- **Services**: Run in Docker containers (PostgreSQL, pgAdmin, etc.)

**Benefits:**
- ✅ Fast hot reload (no container overhead)
- ✅ Easy debugging with your IDE
- ✅ Native performance
- ✅ Simple Docker setup (services only)

### Installation Steps

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings (Auth0, AWS, etc.)
   ```

3. **Start infrastructure services:**
   ```bash
   npm run docker:up
   ```

4. **Initialize database:**
   ```bash
   npm run migrate:db    # Run migrations
   npm run generate:db   # Generate Prisma client
   npm run seed:db       # Seed demo data
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

## Docker Services

### Overview

Docker Compose provides **ONLY** the infrastructure services needed for development. The application runs natively on your machine.

### Services Provided

#### PostgreSQL Database
- **Image:** `postgres:16-alpine`
- **Port:** `5432` (configurable via `POSTGRES_PORT`)
- **Access:** `localhost:5432`
- **Credentials:** Set in `.env` file

### Docker Commands

```bash
# Start services
npm run docker:up

# View service logs
npm run docker:logs

# Check service status
npm run docker:ps

# Stop services
npm run docker:down

# Stop and remove volumes (⚠️ deletes database data)
npm run docker:clean
```

### Manual Docker Compose Commands

```bash
# Start services in detached mode
docker compose up -d

# View logs
docker compose logs -f postgres

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Database Management

### Prisma Commands

```bash
# Run migrations (development)
npm run migrate:db

# Generate Prisma client
npm run generate:db

# Open Prisma Studio (GUI)
npm run studio:db

# Seed database
npm run seed:db

# Reset database (⚠️ destructive)
npm run reset:db

# Drop and recreate database (⚠️ very destructive)
npm run drop:db
```

### Direct PostgreSQL Access

```bash
# Using psql (if installed locally)
psql postgresql://myuser:mypassword@localhost:5432/mydb

# Using Docker exec
docker exec -it origin-food-house-postgres psql -U myuser -d mydb
```

### Database GUI Tools

For database management, you can use:
- **Prisma Studio:** `npm run studio:db` (included)
- **TablePlus, DBeaver, pgAdmin (desktop):** Connect to `localhost:5432`

## Available Scripts

### Development

```bash
npm run dev              # Start development server with hot reload
npm run start            # Start without watch mode
npm run start:debug      # Start with debugger attached
```

### Build & Production

```bash
npm run build            # Build for production
npm run start:prod       # Start production server
```

### Code Quality

```bash
npm run lint             # Lint and fix code
npm run format           # Format code with Prettier
```

### Testing

```bash
npm test                 # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:cov         # Run tests with coverage
npm run test:e2e         # Run end-to-end tests
npm run test:debug       # Debug tests
```

### Docker

```bash
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
npm run docker:logs      # View service logs
npm run docker:ps        # Check service status
npm run docker:clean     # Stop and remove volumes
```

### Database

```bash
npm run migrate:db       # Run Prisma migrations
npm run generate:db      # Generate Prisma client
npm run studio:db        # Open Prisma Studio
npm run seed:db          # Seed database
npm run reset:db         # Reset database
npm run drop:db          # Drop database
```

## Project Structure

```
origin-food-house-backend/
├── src/
│   ├── auth/              # Authentication module (Auth0)
│   ├── user/              # User management
│   ├── store/             # Store management
│   ├── menu/              # Menu items & customizations
│   ├── category/          # Category management
│   ├── table/             # Table management
│   ├── active-table-session/  # Session management
│   ├── cart/              # Cart & checkout
│   ├── order/             # Order processing
│   ├── payment/           # Payment handling
│   ├── kitchen/           # Kitchen Display System
│   ├── common/            # Shared utilities
│   └── main.ts            # Application entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Database migrations
│   └── seed.ts            # Seed data script
├── test/                  # E2E tests
├── docker/
│   └── archive/           # Old Docker configs (reference)
├── docker-compose.yml     # Services only (PostgreSQL, pgAdmin)
├── Dockerfile             # Production build (not for local dev)
├── .env.example           # Environment template
└── package.json           # Dependencies & scripts
```

## Environment Variables

See `.env.example` for a complete list of environment variables.

### Required Variables

```env
# Database
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb"

# Auth0 (Required for authentication)
AUTH0_DOMAIN="your-tenant.auth0.com"
AUTH0_CLIENT_ID="your-client-id"
AUTH0_CLIENT_SECRET="your-client-secret"
AUTH0_AUDIENCE="https://api.your-domain.com"
AUTH0_ISSUER="https://your-tenant.auth0.com/"

# JWT (Internal tokens)
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="1d"

# CORS
CORS_ORIGIN="http://localhost:3001,http://localhost:3002"
```

### Optional Variables

```env
# AWS S3 (File uploads)
AWS_ACCESS_KEY_ID="your-key"
AWS_SECRET_ACCESS_KEY="your-secret"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-bucket"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email"
SMTP_PASS="your-password"
```

## Testing

### Running Tests

```bash
# Unit tests
npm test

# Watch mode (recommended for development)
npm run test:watch

# Coverage report
npm run test:cov

# End-to-end tests
npm run test:e2e
```

### Test Structure

```typescript
// Example test pattern
describe('StoreService', () => {
  let service: StoreService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [StoreService, PrismaService],
    }).compile();

    service = module.get<StoreService>(StoreService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a store', async () => {
    // Test implementation
  });
});
```

## Deployment

### Production Dockerfile

For production deployment, use the `Dockerfile` in the project root:

```bash
# Build production image
docker build -t origin-food-house-backend .

# Run production container (example)
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e AUTH0_DOMAIN="..." \
  origin-food-house-backend
```

**Note:** The `Dockerfile` is for production deployment only, NOT for local development.

### Environment-Specific Deployments

- **AWS ECS/Fargate:** Use the Dockerfile with ECS task definitions
- **Kubernetes:** Create deployment manifests referencing the Docker image
- **Docker Compose (Production):** Create a separate `docker-compose.prod.yml`

### Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Code linted and formatted (`npm run lint`, `npm run format`)
- [ ] Build succeeds (`npm run build`)
- [ ] Environment variables configured for production
- [ ] Database migrations up to date
- [ ] Security review completed
- [ ] Health checks configured

## Additional Documentation

- **Main Project Guide:** `../CLAUDE.md`
- **Backend Development Guide:** `./CLAUDE.md`
- **Auth0 Integration:** `./docs/AUTH0_INTEGRATION.md`
- **API Documentation:** Available at `/api/docs` when server is running

## Support

For issues or questions:
1. Check existing documentation
2. Review the `CLAUDE.md` files
3. Check the archived Docker configs in `docker/archive/`

## License

UNLICENSED - Private project
