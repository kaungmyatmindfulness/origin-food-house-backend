# CLAUDE.md

**Purpose:** Establish development standards, architectural guardrails, and clean code practices for Origin Food House.
**Audience:** Claude Code and human contributors working within this repository.
**Last Updated:** October 2025

---

## 🧩 Project Context

**Origin Food House** is a **multi-tenant restaurant management platform**.
It manages **stores, menus, tables, sessions, orders, and payments** across multiple tenants.
The backend is built with **NestJS**, **Prisma ORM**, and **PostgreSQL**; it follows a **modular, domain-driven architecture** with clean separation between layers.

### Technology Stack
- **Framework:** NestJS v11 (Node.js)
- **Database:** PostgreSQL with Prisma ORM v6
- **Authentication:** JWT + Auth0 integration
- **Real-time:** WebSockets via Socket.io
- **Storage:** AWS S3
- **Testing:** Jest with >80% coverage target
- **Code Quality:** ESLint, Prettier, Husky pre-commit hooks

---

## ⚙️ Development Commands

### Database

```bash
npm run migrate:db      # Run Prisma migrations
npm run generate:db     # Generate Prisma client
npm run studio:db       # Open Prisma Studio
npm run seed:db         # Seed demo data (owner@test.com/test1234)
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
      where: { storeId, deletedAt: null }
    });
  }

  softDelete(id: string) {
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
```

### 5. **Monetary Values**

Always use `Prisma.Decimal` and string constructors to avoid float errors:

```typescript
// ✅ Correct
price: new Prisma.Decimal('9.99')
vatRate: new Prisma.Decimal('0.07')

// ❌ Wrong - float precision issues
price: new Prisma.Decimal(9.99)
```

**Calculation Pattern:**
```typescript
import { Decimal } from '@prisma/client/runtime/library';

const subtotal = new Decimal(item.basePrice)
  .mul(item.quantity)
  .toFixed(2);
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

| Module                       | Responsibility                                |
| ---------------------------- | --------------------------------------------- |
| **AuthModule**               | JWT auth, refresh tokens, RBAC                |
| **StoreModule**              | Store management, user roles                  |
| **MenuModule**               | Menu items, customization groups              |
| **CategoryModule**           | Category CRUD + sorting                       |
| **TableModule**              | Table entities per store                      |
| **ActiveTableSessionModule** | Session management & real-time dining         |
| **OrderModule**              | Orders, VAT/service charge logic              |
| **CartModule**               | Cart + checkout handling                      |
| **CommonModule**             | Decorators, error handler, pagination, logger |
| **EmailModule**              | Password resets, notifications                |
| **UserModule**               | User profiles, memberships                    |

---

## 🧰 Infrastructure Services

- **PrismaService:** Transaction-safe DB client
- **S3Service:** File storage and retrieval
- **CleanupService:** Scheduled removal of orphaned assets

---

## 🧩 Database Schema Highlights

- Entities: `User`, `Store`, `UserStore`, `MenuItem`, `Category`, `Table`, `ActiveTableSession`, `Order`
- Relationships:
  - `Store` ↔ `User` (many-to-many via `UserStore`)
  - `Category` → `MenuItem`
  - `MenuItem` → `CustomizationGroup` → `CustomizationOption`
  - `Table` → `ActiveTableSession`

---

## 🔐 Security Standards

### Authentication & Authorization
- **JWT Strategy:** Access tokens expire in 1 day
- **Auth0 Integration:** OAuth2/OpenID Connect support
- **RBAC:** Role-based access control per store
- **Session Management:** Secure cookie handling with httpOnly flag
- **Password Policy:**
  - Bcrypt with 12 rounds
  - Minimum 8 characters
  - Reset tokens expire in 1 hour

### API Security
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

- Use `@nestjs/config` with schema validation.
- Validate `.env` at startup — never access `process.env` directly.
- Maintain separate `.env.dev`, `.env.prod` files (not committed).
- Use configuration namespaces for different concerns:

```typescript
// auth/config/auth0.config.ts
export default registerAs('auth0', (): Auth0Config => ({
  domain: process.env.AUTH0_DOMAIN ?? '',
  clientId: process.env.AUTH0_CLIENT_ID ?? '',
  // ... other config
}));
```

### Modules

- Each module should own exactly one domain.
- Use `forFeature()` pattern for scoped providers.
- Export only necessary services.
- Follow the module structure pattern:

```typescript
@Module({
  imports: [/* Dependencies */],
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
export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
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
  stack: error.stack
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
  $transaction: jest.fn(callback => callback(mockTransaction)),
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
- Cache common lookups with Redis.

### Pagination Pattern

```typescript
const [items, total] = await Promise.all([
  this.prisma.item.findMany({ skip, take, where, orderBy }),
  this.prisma.item.count({ where }),
]);
return PaginatedResponseDto.create(items, total, page, limit);
```

---

## 🧪 Testing Strategy

1. **Unit Tests** — Validate isolated service logic.
2. **Integration Tests** — Test module interactions with mocked I/O.
3. **E2E Tests** — Full request-to-response validation using test DB.

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

### Database Anti-Patterns
- ❌ N+1 queries (use includes/joins)
- ❌ Missing indexes on frequently queried fields
- ❌ Transactions without rollback handling
- ❌ Direct SQL queries (use Prisma)
- ❌ Missing store isolation checks

---

## 🛠️ Development Workflow

### Pre-commit Checklist
Before committing any changes:

1. **Format code:** `npm run format`
2. **Lint code:** `npm run lint`
3. **Run tests:** `npm run test`
4. **Build project:** `npm run build`
5. **Check for type errors:** `npx tsc --noEmit`

### Code Review Standards
Ensure your code:
- ✅ Follows all architectural principles
- ✅ Has appropriate test coverage
- ✅ Includes proper error handling
- ✅ Uses structured logging
- ✅ Validates all inputs
- ✅ Maintains store isolation
- ✅ Documents complex logic
- ✅ Handles edge cases

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
