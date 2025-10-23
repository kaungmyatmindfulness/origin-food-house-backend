# CLAUDE.md

**Purpose:** Establish development standards, architectural guardrails, and clean code practices for Origin Food House.
**Audience:** Claude Code and human contributors working within this repository.
**Last Updated:** October 2025

## 📋 Recent Updates

### January 2025 - Auth0 Exclusive Authentication

**BREAKING CHANGE:** Local email/password authentication has been completely removed.

**What Changed:**

- ❌ Removed `POST /auth/login` endpoint (local authentication)
- ❌ Removed `AuthService.validateUser()` method
- ❌ Removed email/password validation logic
- ❌ Removed `password` field from User schema
- ❌ Removed `verificationToken`, `verificationExpiry`, `resetToken`, `resetTokenExpiry` fields
- ❌ Removed password-related methods from UserService
- ✅ Auth0 is now the **only** authentication method for staff users
- ✅ Session-based auth remains for customer orders (table sessions)
- ✅ Database no longer stores any password data

**Migration Notes:**

- All staff users must authenticate via Auth0
- Existing users synced automatically on first Auth0 login
- Frontend must implement Auth0 SDK for login flow
- No password data is stored in the database
- Email verification and password reset handled by Auth0

**Why This Change:**

- Improved security through delegated authentication
- Eliminated password storage and management overhead
- Simplified authentication logic and reduced attack surface
- Better user experience with SSO, social login, MFA support
- Compliance with modern authentication best practices
- Reduced database footprint and security liability

---

### October 2025 - Codebase Audit & Documentation Update

**Comprehensive audit completed to align documentation with actual implementation:**

**Infrastructure Updates:**
- ✅ Simplified Docker setup: docker-compose.yml now provides infrastructure only
- ✅ Removed Dockerfile.dev and docker-compose.dev.yml (native development preferred)
- ✅ Production Dockerfile optimized with multi-stage build and health checks

**Module Expansion:**
- ✅ Added PaymentModule (53.75% test coverage)
- ✅ Added KitchenModule with WebSocket gateway (56% coverage)
- ✅ Added ReportModule for analytics (0% coverage - needs tests)
- ✅ Total modules increased from 11 to 14 domain modules

**Testing Status:**
- ✅ 320 tests across 11 test suites (up from 257 tests)
- ✅ OrderModule leads with 78.02% coverage
- ⚠️ Average coverage ~44% (below initial 80% target)
- ❌ Critical gaps: ReportModule (0%), EmailModule (15.78%), ActiveTableSession (18.83%)

**Database Schema:**
- ✅ Expanded from 8 to 19 models
- ✅ Added Refund, CartItem, OrderItem customization tracking
- ✅ All entities support soft deletes and audit trails

**Dependencies Updated:**
- NestJS: v11.1.6
- Prisma: v6.17.1
- Jest: v30.2.0
- Socket.io: v4.8.1
- AWS SDK: v3.908.0

---

## 🧩 Project Context

**Origin Food House** is a **multi-tenant restaurant management platform**.
It manages **stores, menus, tables, sessions, orders, and payments** across multiple tenants.
The backend is built with **NestJS**, **Prisma ORM**, and **PostgreSQL**; it follows a **modular, domain-driven architecture** with clean separation between layers.

### Technology Stack

- **Framework:** NestJS v11.1.6 (Node.js)
- **Database:** PostgreSQL 16 with Prisma ORM v6.17.1
- **Authentication:** JWT + Auth0 integration (OAuth2/OpenID Connect)
- **Real-time:** WebSockets via Socket.io v4.8.1
- **Storage:** AWS S3 (via @aws-sdk/client-s3 v3.908.0)
- **Testing:** Jest v30.2.0 - 11 test suites, 320 tests
- **Code Quality:** ESLint v9.37.0, Prettier v3.6.2, Husky v9.1.7 pre-commit hooks

---

## ⚙️ Development Commands

### Database

```bash
npm run migrate:db      # Run Prisma migrations
npm run generate:db     # Generate Prisma client
npm run studio:db       # Open Prisma Studio
npm run seed:db         # Seed demo data (kraft@originfoodhouse.com)
npm run reset:db        # Reset database (wipe + migrate)
npm run drop:db         # Drop schema completely
```

### App Lifecycle

```bash
npm run dev             # Start development server
npm run build           # Build for production
npm run start:prod      # Run production server
npm run lint            # Run ESLint autofix
npm run format          # Prettier code formatting
```

### Testing

```bash
npm run test            # Run unit tests
npm run test:watch      # Watch mode
npm run test:cov        # Coverage report
npm run test:e2e        # End-to-end tests
```

### Docker (Local Development - Infrastructure Only)

```bash
npm run docker:up       # Start PostgreSQL and infrastructure services
npm run docker:down     # Stop all services
npm run docker:logs     # View container logs
npm run docker:ps       # Check container status
npm run docker:clean    # Remove containers and volumes
```

**Note:** Docker Compose provides only infrastructure services (PostgreSQL). Run the app natively during development.

---

## 🧠 Architectural Principles

### 1. **Domain Isolation**

Each module (Auth, Store, Menu, etc.) owns its data and logic.
Never reach across modules without an explicit interface or service contract.

**✅ DO:**

```typescript
// Use injected services
constructor(private authService: AuthService) {}
```

**❌ DON'T:**

```typescript
// Direct Prisma calls across domains
await this.prisma.userStore.findMany(); // In non-auth module
```

### 2. **Store-Scoped Data**

Every persistent entity includes `storeId`.
Always query with:

```typescript
where: { storeId, deletedAt: null }
```

**Implementation Pattern:**

```typescript
// Service method pattern
async findMenuItems(storeId: string): Promise<MenuItem[]> {
  return this.prisma.menuItem.findMany({
    where: {
      storeId,
      deletedAt: null,
      isHidden: false
    },
    orderBy: { sortOrder: 'asc' }
  });
}
```

### 3. **Transactional Integrity**

For multi-step writes, wrap all operations in Prisma transactions:

```typescript
await this.prisma.$transaction(async (tx) => {
  const store = await tx.store.create({ ... });
  await tx.storeInformation.create({ ... });
  await tx.storeSetting.create({ ... });
  await tx.userStore.create({ ... });
  return store;
});
```

**Transaction Patterns:**

- Use `$transaction` for related writes
- Pass transaction client (`tx`) to nested functions
- Handle rollback scenarios explicitly
- Set appropriate isolation levels for critical operations

### 4. **Soft Deletes**

Never delete rows. Mark them instead:

```typescript
update({ where: { id }, data: { deletedAt: new Date() } });
```

**Query Pattern:**

```typescript
// Repository pattern for soft deletes
class CategoryRepository {
  findActive(storeId: string) {
    return this.prisma.category.findMany({
      where: { storeId, deletedAt: null },
    });
  }

  softDelete(id: string) {
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

### 5. **Monetary Values**

Always use `Prisma.Decimal` and string constructors to avoid float errors:

```typescript
// ✅ Correct
price: new Prisma.Decimal('9.99');
vatRate: new Prisma.Decimal('0.07');

// ❌ Wrong - float precision issues
price: new Prisma.Decimal(9.99);
```

**Calculation Pattern:**

```typescript
import { Decimal } from '@prisma/client/runtime/library';

const subtotal = new Decimal(item.basePrice).mul(item.quantity).toFixed(2);
```

### 6. **Access Control**

Every store mutation must validate role-based access:

```typescript
await this.authService.checkStorePermission(userId, storeId, [
  Role.OWNER,
  Role.ADMIN,
]);
```

**Role Hierarchy:**

- **OWNER:** Full access, can transfer ownership
- **ADMIN:** Manage store, users, and settings
- **CHEF:** Manage orders and menu items
- **CASHIER:** Handle payments and orders
- **SERVER:** Take orders and manage tables

---

## 🧱 Core Modules & Responsibilities

| Module                       | Responsibility                                  | Test Coverage |
| ---------------------------- | ----------------------------------------------- | ------------- |
| **AuthModule**               | Auth0 integration, JWT generation, RBAC         | 23.83%        |
| **StoreModule**              | Store management, user roles                    | 53.10%        |
| **MenuModule**               | Menu items, customization groups                | 56.41%        |
| **CategoryModule**           | Category CRUD + sorting                         | 59.48%        |
| **TableModule**              | Table entities per store                        | 62.10%        |
| **ActiveTableSessionModule** | Session management & real-time dining           | 18.83%        |
| **OrderModule**              | Orders, VAT/service charge logic                | 78.02%        |
| **CartModule**               | Cart + checkout handling                        | 49.07%        |
| **PaymentModule**            | Payment recording, refund processing            | 53.75%        |
| **KitchenModule**            | Kitchen Display System (KDS), order status      | 56.00%        |
| **ReportModule**             | Sales reports, analytics, business intelligence | 0.00%         |
| **UserModule**               | User profiles, memberships, Auth0 sync          | 60.86%        |
| **EmailModule**              | Email notifications (Auth0 handles auth emails) | 15.78%        |
| **CommonModule**             | Decorators, error handler, pagination, logger   | Varies        |

**Total:** 14 domain modules + infrastructure services

---

## 🧰 Infrastructure Services

- **PrismaService:** Transaction-safe DB client with connection pooling
- **S3Service:** AWS S3 file storage and retrieval with Sharp image processing
- **UploadService:** File upload handling with validation and size limits
- **CleanupService:** Scheduled removal of orphaned S3 assets
- **Auth0Service:** Auth0 Management API integration for user sync

---

## 🧩 Database Schema Highlights

**19 Models:** `User`, `Store`, `UserStore`, `StoreInformation`, `StoreSetting`, `Category`, `MenuItem`, `CustomizationGroup`, `CustomizationOption`, `Table`, `ActiveTableSession`, `Cart`, `CartItem`, `CartItemCustomization`, `Order`, `OrderItem`, `OrderItemCustomization`, `Payment`, `Refund`

**Key Relationships:**
- `Store` ↔ `User` (many-to-many via `UserStore`)
- `Store` → `StoreInformation`, `StoreSetting` (one-to-one)
- `Category` → `MenuItem` (one-to-many)
- `MenuItem` → `CustomizationGroup` → `CustomizationOption` (nested one-to-many)
- `Table` → `ActiveTableSession` (one-to-many)
- `ActiveTableSession` → `Cart` → `CartItem` → `CartItemCustomization`
- `Order` → `OrderItem` → `OrderItemCustomization`
- `Order` → `Payment` → `Refund`

**Design Patterns:**
- All business entities support soft deletes (`deletedAt` timestamp)
- All monetary values use `Decimal` type for precision
- Multi-tenancy enforced via `storeId` foreign key
- Audit trails with `createdAt` and `updatedAt` timestamps

---

## 🔐 Security Standards

### ⚠️ Authentication Model

**This application uses Auth0 exclusively for authentication. There is NO local email/password login.**

- All authentication flows go through Auth0 (OAuth2/OpenID Connect)
- Internal JWTs are generated after Auth0 token validation
- No password data is stored in the database
- Session-based auth used for customer ordering (table sessions)

---

## 🔑 Authentication Flow (Auth0 Only)

### Staff Authentication (POS App)

```
1. User clicks "Login with Auth0" in frontend
2. Frontend redirects to Auth0 Universal Login
3. User authenticates via Auth0 (email/password, social, SSO, etc.)
4. Auth0 redirects back with access token
5. Frontend calls POST /auth/auth0/validate with Auth0 token
6. Backend:
   - Validates token via Auth0 JWKS
   - Syncs user to local database (create/update)
   - Generates internal JWT (no store context yet)
   - Sets HttpOnly cookie
7. User selects store via POST /auth/login/store
8. Backend:
   - Validates user membership in store
   - Generates store-scoped JWT (includes storeId, role)
   - Updates HttpOnly cookie
9. User authenticated with store context
```

### Customer Authentication (SOS App)

```
1. Customer scans QR code on table
2. Frontend calls POST /active-table-sessions/join-by-table/:tableId
3. Backend:
   - Creates/joins session for table
   - Generates session-scoped JWT
   - Returns session token
4. Customer can order with session context (no Auth0 required)
```

### Available Auth Endpoints

| Endpoint               | Method | Description                     | Auth Required |
| ---------------------- | ------ | ------------------------------- | ------------- |
| `/auth/auth0/config`   | GET    | Get Auth0 configuration         | No            |
| `/auth/auth0/validate` | POST   | Validate Auth0 token, sync user | No            |
| `/auth/login/store`    | POST   | Select store after Auth0 login  | Yes (JWT)     |
| `/auth/auth0/profile`  | GET    | Get user profile                | Yes (Auth0)   |

---

### Authentication & Authorization

- **Auth0 Integration:** Primary authentication via OAuth2/OpenID Connect
- **Internal JWT Strategy:** Access tokens expire in 1 day (generated after Auth0 validation)
- **RBAC:** Role-based access control per store
- **Session Management:** Secure cookie handling with httpOnly flag
- **No Local Authentication:** Email/password login removed - Auth0 only
- **User Sync:** Auth0 users automatically synced to local database on first login

### API Security

- **Authentication:** Auth0 tokens validated via JWKS
- **Rate Limiting:** 60 requests/minute per IP
- **Input Validation:** All DTOs validated with class-validator
- **SQL Injection:** Use Prisma parameterized queries only
- **XSS Prevention:** Sanitize all user inputs
- **CORS:** Configure allowed origins explicitly
- **Headers:** Implement security headers (CSP, X-Frame-Options, etc.)

### Data Protection

- **Store Isolation:** Multi-tenancy enforced at query level
- **Soft Deletes:** Maintain audit trail, no hard deletes
- **PII Handling:** Encrypt sensitive data at rest
- **File Upload:**
  - Validate MIME types
  - Limit file sizes (10MB default)
  - Scan for malware before S3 upload
  - Generate unique filenames to prevent collisions

### Error Handling Security

```typescript
// Never expose internal details
catch (error) {
  this.logger.error('Internal error', error);
  throw new InternalServerErrorException('An error occurred');
}
```

---

## 🧭 Clean Code Guardrails

### Configuration

- Use `@nestjs/config` with `ConfigService` for all environment variable access
- **NEVER** access `process.env` directly in application code (security best practice)
- Validate environment variables at application startup
- Maintain separate `.env` files per environment (not committed to git)
- Use configuration namespaces via `registerAs()` for domain-specific config

**Current Configuration Files:**
- `src/auth/config/auth0.config.ts` - Auth0 OAuth2/OIDC settings

**Configuration Pattern:**

```typescript
// auth/config/auth0.config.ts
export default registerAs(
  'auth0',
  (): Auth0Config => ({
    domain: process.env.AUTH0_DOMAIN ?? '',
    clientId: process.env.AUTH0_CLIENT_ID ?? '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET ?? '',
    audience: process.env.AUTH0_AUDIENCE ?? '',
    issuer: process.env.AUTH0_ISSUER ?? '',
  }),
);

// In modules
@Module({
  imports: [ConfigModule.forFeature(auth0Config)],
})

// In services
constructor(@Inject('auth0') private auth0Config: Auth0Config) {}
```

### Modules

- Each module should own exactly one domain.
- Use `forFeature()` pattern for scoped providers.
- Export only necessary services.
- Follow the module structure pattern:

```typescript
@Module({
  imports: [
    /* Dependencies */
  ],
  controllers: [StoreController],
  providers: [StoreService, StoreRepository],
  exports: [StoreService], // Only export what's needed
})
export class StoreModule {}
```

### Repositories

- No direct Prisma calls in controllers.
- Encapsulate persistence logic:

```typescript
export class UserRepository {
  constructor(private prisma: PrismaService) {}
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
```

### Controllers

- Keep controllers thin. No business logic.
- Always return typed DTOs.
- Use decorators for exception filtering and validation.

### DTOs

- Use `class-transformer` for input normalization.
- Example:

```typescript
export class ChooseStoreDto {
  @IsUUID()
  @IsNotEmpty()
  storeId: string;
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### Error Handling

Map Prisma errors explicitly:

```typescript
catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        throw new ConflictException('Duplicate record');
      case 'P2025':
        throw new NotFoundException('Record not found');
      case 'P2003':
        throw new BadRequestException('Foreign key constraint failed');
      default:
        this.logger.error('Database error', error);
        throw new InternalServerErrorException('Database operation failed');
    }
  }
  throw error;
}
```

Never expose stack traces or internal error messages.

### Error Response Standards

```typescript
// Service layer - detailed logging
this.logger.error(`[${method}] Failed to create store`, {
  userId,
  storeName: dto.name,
  error: error.message,
  stack: error.stack,
});

// Client response - generic message
throw new InternalServerErrorException('Could not create store');
```

### Logging

- Use NestJS `Logger` service for consistency.
- Log structured data with contextual information.
- Follow log levels appropriately:

```typescript
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  async createStore(userId: string, dto: CreateStoreDto) {
    const method = this.createStore.name;

    // Info level for normal operations
    this.logger.log(`[${method}] User ${userId} creating store: ${dto.name}`);

    try {
      // ... operation
      this.logger.log(`[${method}] Store created successfully`);
    } catch (error) {
      // Error level for failures
      this.logger.error(`[${method}] Failed to create store`, error.stack);
      // Warn level for business logic issues
      this.logger.warn(`[${method}] Duplicate store name attempted`);
    }
  }
}
```

### Testing

- Mock Prisma in service tests using the helper pattern:
- Use test fixtures and builders for consistent test data.
- Maintain >80% coverage on core modules.

```typescript
// common/testing/prisma-mock.helper.ts
export const createPrismaMock = () => ({
  store: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockTransaction)),
});

// In tests
beforeEach(() => {
  const prismaMock = createPrismaMock();
  // ... setup
});
```

### Test Organization

```typescript
describe('StoreService', () => {
  describe('createStore', () => {
    it('should create store with default settings', async () => {});
    it('should throw BadRequestException for duplicate slug', async () => {});
    it('should rollback transaction on failure', async () => {});
  });
});
```

### Performance

- Always use Prisma `select` or `include` to minimize data.
- Paginate all list queries.
- Add DB indexes for heavy read fields.
- Use `Promise.all` for concurrent DB reads.

### Pagination Pattern

```typescript
const [items, total] = await Promise.all([
  this.prisma.item.findMany({ skip, take, where, orderBy }),
  this.prisma.item.count({ where }),
]);
return PaginatedResponseDto.create(items, total, page, limit);
```

---

## 🧪 Testing Strategy & Current Status

### Testing Approach

1. **Unit Tests** — Validate isolated service logic with mocked dependencies
2. **Integration Tests** — Test module interactions with mocked I/O
3. **E2E Tests** — Full request-to-response validation using test DB

### Current Test Statistics (October 2025)

- **Total Test Suites:** 11 suites
- **Total Tests:** 320 tests (all passing ✅)
- **Overall Coverage:** ~44% average across all modules

**Module-Level Coverage:**

| Priority | Module                | Coverage | Status             | Action Needed              |
| -------- | --------------------- | -------- | ------------------ | -------------------------- |
| 🔴 HIGH  | ReportModule          | 0.00%    | ❌ No tests        | Create comprehensive tests |
| 🔴 HIGH  | EmailModule           | 15.78%   | ⚠️ Minimal         | Add email template tests   |
| 🔴 HIGH  | ActiveTableSession    | 18.83%   | ⚠️ Minimal         | Add session lifecycle tests|
| 🟡 MED   | AuthModule            | 23.83%   | ⚠️ Partial         | Add Auth0 integration tests|
| 🟡 MED   | CartModule            | 49.07%   | ⚠️ Moderate        | Add WebSocket tests        |
| 🟢 LOW   | StoreModule           | 53.10%   | ✅ Moderate        | Maintain coverage          |
| 🟢 LOW   | PaymentModule         | 53.75%   | ✅ Moderate        | Add refund scenario tests  |
| 🟢 LOW   | KitchenModule         | 56.00%   | ✅ Moderate        | Add gateway tests          |
| 🟢 LOW   | MenuModule            | 56.41%   | ✅ Moderate        | Maintain coverage          |
| 🟢 LOW   | CategoryModule        | 59.48%   | ✅ Good            | Maintain coverage          |
| 🟢 LOW   | UserModule            | 60.86%   | ✅ Good            | Maintain coverage          |
| 🟢 LOW   | TableModule           | 62.10%   | ✅ Good            | Maintain coverage          |
| ✅ DONE  | OrderModule           | 78.02%   | ✅ Excellent       | Production ready           |

**Key Gaps:**
- No E2E tests for critical user flows
- WebSocket/real-time functionality undertested
- Report generation module completely untested
- Auth0 integration relies on manual testing

**Testing Tools:**
- Jest v30.2.0 with ts-jest for TypeScript support
- Prisma mock helper (`createPrismaMock()`) for service tests
- Supertest for E2E HTTP request testing

---

## 🎯 Code Quality Standards

### ESLint Rules

Key enforced rules:

- `@typescript-eslint/no-explicit-any`: Warn (off in tests)
- `@typescript-eslint/no-floating-promises`: Error
- `@typescript-eslint/prefer-nullish-coalescing`: Error
- `@typescript-eslint/return-await`: Always await in try-catch
- `no-console`: Error (use Logger instead)
- `import/order`: Alphabetized and grouped

### Naming Conventions

- **Files:** `kebab-case.ts` (e.g., `store.service.ts`)
- **Classes:** `PascalCase` (e.g., `StoreService`)
- **Interfaces:** `PascalCase` with no `I` prefix
- **Methods:** `camelCase` (e.g., `createStore`)
- **DTOs:** Suffix with `Dto` (e.g., `CreateStoreDto`)
- **Constants:** `UPPER_SNAKE_CASE`

### Async/Await Patterns

```typescript
// ✅ Correct - always await in try-catch
try {
  return await this.prisma.store.create({ data });
} catch (error) {
  // Handle error
}

// ❌ Wrong - missing await
try {
  return this.prisma.store.create({ data });
} catch (error) {
  // Won't catch async errors!
}
```

## 🚨 Anti-Patterns to Avoid

### Code Smells

- ❌ Direct `process.env` access (use ConfigService)
- ❌ Business logic in controllers (use services)
- ❌ Raw Prisma calls outside services
- ❌ Hard deletes (use soft deletes)
- ❌ Console logs (use Logger service)
- ❌ Unvalidated DTOs (always use decorators)
- ❌ Query overfetching (use `select`/`include`)
- ❌ Tight coupling between modules
- ❌ Floating promises (always await or handle)
- ❌ Magic numbers/strings (use constants)
- ❌ Nested callbacks (use async/await)
- ❌ Global state mutations

### Authentication Anti-Patterns

- ❌ Creating local password authentication (use Auth0 only)
- ❌ Storing passwords in the database (Auth0 handles authentication)
- ❌ Implementing custom JWT validation (use Auth0 JWKS)
- ❌ Bypassing Auth0 for staff authentication
- ❌ Using Auth0 for customer orders (use session-based auth)

### Database Anti-Patterns

- ❌ N+1 queries (use includes/joins)
- ❌ Missing indexes on frequently queried fields
- ❌ Transactions without rollback handling
- ❌ Direct SQL queries (use Prisma)
- ❌ Missing store isolation checks

---

## 🛠️ Development Workflow

### 🚦 MANDATORY Task Completion Guardrails

**CRITICAL**: Every backend task MUST pass ALL quality gates before being marked complete. No exceptions.

#### Quality Gate Execution Order

Run these checks in order for EVERY task:

```bash
# Step 1: Code Formatting (MUST pass)
npm run format

# Step 2: Linting (MUST pass - 0 errors, auto-fix enabled)
npm run lint

# Step 3: Type Checking (MUST pass - 0 errors)
npx tsc --noEmit

# Step 4: Tests (MUST pass - all 320+ tests)
npm run test

# Step 5: Build (MUST succeed)
npm run build

# Step 6: Database (if schema changed)
npm run generate:db  # After schema.prisma changes
npm run migrate:db   # To create migration (dev only)
```

#### Test Coverage Requirements

**Critical Modules** (≥85% coverage MANDATORY):
- CartModule, OrderModule, PaymentModule
- MenuModule, CategoryModule, TableModule
- UserModule, AuthModule

**New Code Requirements**:
- ✅ New service methods: **100% test coverage**
- ✅ Financial calculations: **Decimal precision tests**
- ✅ Security operations: **RBAC validation tests**
- ✅ Database transactions: **Rollback scenario tests**

#### Task NOT Complete Until

**Code Quality:**
- ✅ All 320+ tests pass
- ✅ Build completes without errors
- ✅ Linting shows 0 errors
- ✅ Type checking shows 0 errors
- ✅ Code is formatted (Prettier)

**Testing:**
- ✅ New tests added for new functionality
- ✅ Test coverage meets requirements (≥85% for critical modules)
- ✅ Edge cases covered
- ✅ Error scenarios tested

**Architecture & Security:**
- ✅ No `process.env` direct access (use ConfigService)
- ✅ Store isolation enforced (`storeId` + `deletedAt: null`)
- ✅ RBAC permissions validated
- ✅ DTOs have validation decorators
- ✅ Errors mapped properly (no internal exposure)
- ✅ Structured logging used (Logger service)
- ✅ Soft deletes implemented (no hard deletes)

**Database (if applicable):**
- ✅ Schema changes have migrations
- ✅ Prisma client regenerated
- ✅ Seed data updated (if needed)
- ✅ Foreign key constraints verified

#### When Quality Gates Fail

**If ANY check fails:**

1. ❌ **DO NOT** mark task as complete
2. 🔧 **FIX** the failing check immediately
3. 🔄 **RE-RUN** ALL quality gates from Step 1
4. ✅ **VERIFY** all checks pass before proceeding

**Common Failure Resolutions:**

| Failure | Resolution |
|---------|-----------|
| Format fails | Run `npm run format` and commit changes |
| Lint errors | Fix errors manually or use `npm run lint` (has --fix) |
| Type errors | Fix TypeScript errors, check imports, verify types |
| Tests fail | Debug failed tests, update mocks, fix logic |
| Build fails | Check syntax errors, missing dependencies |
| Coverage low | Add tests for uncovered branches |

#### Automated Verification Script

**Copy-paste this to verify ALL backend quality gates:**

```bash
#!/bin/bash
set -e  # Exit on first error

echo "🔍 Running Backend Quality Gates..."

echo "Step 1/5: Formatting..."
npm run format || { echo "❌ Format failed"; exit 1; }

echo "Step 2/5: Linting..."
npm run lint || { echo "❌ Lint failed"; exit 1; }

echo "Step 3/5: Type Checking..."
npx tsc --noEmit || { echo "❌ Type check failed"; exit 1; }

echo "Step 4/5: Tests..."
npm run test || { echo "❌ Tests failed"; exit 1; }

echo "Step 5/5: Build..."
npm run build || { echo "❌ Build failed"; exit 1; }

echo ""
echo "✅✅✅ ALL BACKEND QUALITY GATES PASSED ✅✅✅"
echo "Task is ready for completion!"
```

#### Task Completion Certification

**Before marking ANY backend task complete, certify:**

```
✅ All 5 quality gate steps passed
✅ Code formatted, linted, type-safe
✅ All 320+ tests pass
✅ Build succeeds
✅ Test coverage ≥85% (critical modules)
✅ New tests added for new functionality
✅ Security requirements enforced
✅ Architecture patterns followed
✅ Database migrations created (if schema changed)
✅ No `process.env` direct access
✅ ConfigService used for environment variables
✅ RBAC permissions validated
✅ Soft deletes implemented
✅ Structured logging used

BACKEND TASK COMPLETION VERIFIED ✅
```

**RULE**: If you cannot certify ALL items above, the task is NOT complete.

### Code Review Standards

Ensure your code:

- ✅ Follows all architectural principles
- ✅ Has appropriate test coverage (≥85% for critical modules)
- ✅ Includes proper error handling
- ✅ Uses structured logging (Logger service)
- ✅ Validates all inputs (class-validator decorators)
- ✅ Maintains store isolation (storeId filtering)
- ✅ Documents complex logic (JSDoc comments)
- ✅ Handles edge cases (tested)
- ✅ Uses ConfigService (never process.env)
- ✅ Implements soft deletes (deletedAt timestamp)

### Git Commit Standards

```bash
# Format: <type>(<scope>): <subject>
feat(auth): add Auth0 integration
fix(store): resolve duplicate slug issue
refactor(menu): improve query performance
test(cart): add unit tests for checkout
docs(api): update Swagger documentation
```

## 🔍 Common Patterns & Solutions

### Multi-tenant Query Pattern

```typescript
async findStoreData(userId: string, storeId: string) {
  // Always verify membership first
  await this.authService.checkStorePermission(userId, storeId, [Role.ADMIN]);

  // Then query with store isolation
  return this.prisma.menuItem.findMany({
    where: { storeId, deletedAt: null }
  });
}
```

### File Upload Pattern

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}))
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  const url = await this.s3Service.uploadFile(file);
  return { url };
}
```

### WebSocket Events Pattern

```typescript
@WebSocketGateway()
export class OrderGateway {
  @SubscribeMessage('order:update')
  handleOrderUpdate(@MessageBody() data: UpdateOrderDto) {
    // Validate, process, and emit to relevant rooms
    this.server.to(`store-${data.storeId}`).emit('order:updated', data);
  }
}
```

## 🧱 Philosophy

This codebase should:

- Read like a **well-designed system**, not an accident that compiles.
- Prioritize **correctness**, **clarity**, and **maintainability** over speed.
- Enable any engineer—human or AI—to safely extend it without context loss.
- Follow **SOLID principles** and **clean architecture** patterns.
- Be **testable**, **scalable**, and **observable**.

## 📋 Implementation Checklist

For every task:

1. ☐ Understand the business requirement
2. ☐ Design the solution following architectural principles
3. ☐ Write tests first (TDD approach when possible)
4. ☐ Implement the feature
5. ☐ Add proper logging and error handling
6. ☐ Update API documentation
7. ☐ Run linter and formatter
8. ☐ Ensure all tests pass
9. ☐ Build the project successfully
10. ☐ Verify no regression in existing features

## ⚠️ Critical Reminders

- **NEVER** commit sensitive data (.env files, credentials)
- **ALWAYS** validate user input and sanitize outputs
- **ENSURE** store isolation in multi-tenant operations
- **USE** transactions for multi-step database operations
- **IMPLEMENT** proper rate limiting on public endpoints
- **MAINTAIN** backward compatibility when updating APIs
- **DOCUMENT** breaking changes in migration guides

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Auth0 Integration Guide](https://auth0.com/docs)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

**Remember:** Quality over velocity. A well-architected solution today saves debugging time tomorrow.

---

## 🔄 Authentication Architecture Summary

### Current State (January 2025)

```
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Staff Users (POS App)                                       │
│  ─────────────────────                                       │
│  1. Auth0 Universal Login                                    │
│  2. OAuth2/OIDC Flow                                         │
│  3. Token Validation (JWKS)                                  │
│  4. User Sync to DB                                          │
│  5. Internal JWT Generation                                  │
│  6. Store Selection                                          │
│  7. Store-Scoped JWT                                         │
│                                                               │
│  Customers (SOS App)                                         │
│  ────────────────────                                        │
│  1. QR Code Scan                                             │
│  2. Table Session Creation                                   │
│  3. Session JWT                                              │
│  4. Order Placement                                          │
│                                                               │
│  ⚠️  NO LOCAL PASSWORD AUTHENTICATION                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Strategies

| Strategy          | File                | Usage                           | Status     |
| ----------------- | ------------------- | ------------------------------- | ---------- |
| Auth0Strategy     | `auth0.strategy.ts` | Validates Auth0 tokens via JWKS | ✅ Active  |
| JwtStrategy       | `jwt.strategy.ts`   | Validates internal JWTs         | ✅ Active  |
| ~~LocalStrategy~~ | ~~Removed~~         | ~~Email/password validation~~   | ❌ Removed |

### Key Implementation Files

```
src/auth/
├── auth.controller.ts         # Auth endpoints (Auth0 only)
├── auth.service.ts           # Auth logic, user sync, JWT generation
├── auth.module.ts            # Module configuration
├── strategies/
│   └── auth0.strategy.ts     # Auth0 token validation
├── jwt.strategy.ts           # Internal JWT validation
├── services/
│   └── auth0.service.ts      # Auth0 API integration
└── guards/
    ├── auth0.guard.ts        # Auth0 route protection
    ├── jwt-auth.guard.ts     # JWT route protection
    └── ws-jwt.guard.ts       # WebSocket JWT validation
```

---

## 🐳 Docker & Deployment

### Local Development Setup

The project uses Docker Compose **only for infrastructure services** (PostgreSQL). The application runs natively on your machine for better developer experience.

**docker-compose.yml** (Local Development):
- Provides PostgreSQL 16 Alpine container
- Exposes port 5432 for database connections
- Includes health checks for service readiness
- Persists data in named volume `postgres-data`

**Usage:**
```bash
npm run docker:up      # Start PostgreSQL
npm run dev            # Run app natively (connects to Docker PostgreSQL)
npm run docker:down    # Stop services when done
```

### Production Deployment

**Dockerfile** (Production):
- Multi-stage build for optimized image size
- Alpine Linux base (node:lts-alpine)
- Non-root user (nestjs:nodejs with UID 1001)
- Prisma client pre-generated at build time
- Health check endpoint at `/health`
- Startup script handles database migrations
- Node.js memory limit: 2GB (`--max-old-space-size=2048`)

**Build & Deploy:**
```bash
docker build -t origin-food-house-backend .
docker run -p 3000:3000 --env-file .env.prod origin-food-house-backend
```

**Environment Requirements:**
- `DATABASE_URL`: PostgreSQL connection string
- `AUTH0_*`: Auth0 configuration variables
- `JWT_SECRET`: JWT signing secret
- `AWS_*`: S3 credentials (optional)
- `SMTP_*`: Email configuration (optional)

### Removed Files (October 2025)

The following development Docker files were removed in favor of native development:
- ❌ `Dockerfile.dev` (removed)
- ❌ `docker-compose.dev.yml` (removed)
- ❌ `docker-entrypoint.sh` (production only)

---

## 📚 Related Documentation

- **Auth0 Setup:** `/docs/AUTH0_INTEGRATION.md`
- **Business Logic:** `/docs/BUSINESS_DOC_V1.md`
- **Technical Architecture:** `/docs/TECHNICAL_DOC_V1.md`
- **Frontend Integration:** `../origin-food-house-frontend/CLAUDE.md`
- **Root Project Guide:** `../CLAUDE.md`
