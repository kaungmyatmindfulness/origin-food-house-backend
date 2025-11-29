# Development Commands

## Essential Commands

```bash
# Setup & Installation
npm install                 # Install dependencies
cp .env.example .env        # Configure environment (REQUIRED: Auth0 credentials)
npm run docker:up           # Start PostgreSQL database
npm run migrate:db          # Run database migrations
npm run generate:db         # Generate Prisma client
npm run seed:db             # Seed database with demo data

# Development
npm run dev                 # Start dev server with hot reload (port 3000)
npm run typecheck           # Type check without emitting

# Code Quality (MUST PASS before commit)
npm run format              # Format code with Prettier
npm run lint                # Lint and auto-fix with ESLint
npm run build               # Build for production (validates compilation)

# Testing
npm test                    # Run all unit tests
npm run test:watch          # Run tests in watch mode
npm run test:cov            # Run tests with coverage report
npm run test:e2e            # Run end-to-end tests

# Database Management
npm run studio:db           # Open Prisma Studio (database GUI)
npm run reset:db            # Reset database (destructive)
```

## Quality Gates (Every Completion)

Before marking ANY task as complete, you MUST run these commands in sequence and ALL must succeed:

```bash
npm run format              # 1. Format code
npm run lint                # 2. Lint passes
npm run typecheck           # 3. Type check passes
npm test                    # 4. All tests pass
npm run build               # 5. Build succeeds
```

**CRITICAL**: If any of these commands fail, the task is NOT complete. Fix all errors before proceeding.

## Environment Variables

**REQUIRED for development:**

```env
NODE_ENV=dev
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# Auth0 (REQUIRED - exclusive authentication)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_AUDIENCE=https://api.your-domain.com
AUTH0_ISSUER=https://your-tenant.auth0.com/

# JWT (Internal tokens)
JWT_SECRET=minimum-32-character-secret-key
JWT_EXPIRES_IN=1d

# CORS
CORS_ORIGIN=http://localhost:3001,http://localhost:3002
```

**NEVER**:
- Commit `.env` files
- Use `process.env.VARIABLE` directly (use `ConfigService`)
- Use weak JWT secrets (<32 characters)

## Git Workflow

### Commit Messages

**Follow conventional commits:**

```bash
# Format: <type>(<scope>): <subject>

feat(auth): add Auth0 JWKS token validation
fix(cart): prevent race condition in WebSocket cart sync
refactor(store): extract slug generation to utility function
test(order): add coverage for discount calculation edge cases
docs(api): update Swagger docs for payment endpoints
chore(deps): upgrade Prisma to 6.17.1
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `security`

### Pre-Commit Hooks

**Husky + lint-staged automatically runs:**

```bash
1. ESLint --fix on staged files
2. Prettier --write on staged files
```

**Manual verification before push:**

```bash
npm run typecheck  # Must pass
npm test           # Must pass
npm run build      # Must pass
```

## Known Issues & Workarounds

### Test Suite Failures

**Status**: 11 of 17 test suites fail to compile (TypeScript errors)

**Before adding new tests:**

```bash
# Check if your test file compiles
npx tsc --noEmit src/your-module/your-module.service.spec.ts
```

### Security Vulnerabilities

**4 Critical P0 Vulnerabilities** - See [Security Audit](docs/security-audit/2025-10-28-comprehensive-security-audit.md)

**When working on affected modules:**

1. `src/cart/cart.gateway.ts` - Add WebSocket authentication
2. `src/active-table-session/` - Remove session tokens from responses
3. `src/cart/cart.controller.ts` - Add checkout authentication
4. All session operations - Validate `tableId` belongs to user's `storeId`
