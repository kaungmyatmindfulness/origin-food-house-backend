# CLAUDE.md

**Purpose:** Establish development standards, architectural guardrails, and clean code practices for Origin Food House.
**Audience:** Claude Code and human contributors working within this repository.

---

## 🧩 Project Context

**Origin Food House** is a **multi-tenant restaurant management platform**.
It manages **stores, menus, tables, sessions, orders, and payments** across multiple tenants.
The backend is built with **NestJS**, **Prisma ORM**, and **PostgreSQL**; it follows a **modular, domain-driven architecture** with clean separation between layers.

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

### 2. **Store-Scoped Data**

Every persistent entity includes `storeId`.
Always query with:

```typescript
where: { storeId, deletedAt: null }
```

### 3. **Transactional Integrity**

For multi-step writes, wrap all operations in Prisma transactions:

```typescript
await this.prisma.$transaction(async (tx) => { ... });
```

### 4. **Soft Deletes**

Never delete rows. Mark them instead:

```typescript
update({ where: { id }, data: { deletedAt: new Date() } });
```

### 5. **Monetary Values**

Always use `Prisma.Decimal` and string constructors to avoid float errors:

```typescript
price: new Prisma.Decimal('9.99');
```

### 6. **Access Control**

Every store mutation must validate role-based access:

```typescript
await this.authService.checkStorePermission(userId, storeId, [
  Role.OWNER,
  Role.ADMIN,
]);
```

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

- Enforce store isolation in all queries
- Validate all DTOs using `class-validator`
- Rate-limit all endpoints (60 req/min)
- Use JWT guards and refresh tokens
- No hard deletes, no raw SQL
- Audit via soft delete timestamps
- Hash passwords with bcrypt (12 rounds)

---

## 🧭 Clean Code Guardrails

### Configuration

- Use `@nestjs/config` with `zod` or `joi` schema validation.
- Validate `.env` at startup — never access `process.env` directly.
- Maintain separate `.env.dev`, `.env.prod` files (not committed).

### Modules

- Each module should own exactly one domain.
- Use `forFeature()` pattern for scoped providers.
- Export only necessary services.

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
if (error.code === 'P2002') throw new ConflictException('Duplicate record');
if (error.code === 'P2025') throw new NotFoundException('Record not found');
```

Never expose stack traces or internal error messages.

### Logging

- Use `LoggerService` or pino/winston wrapper.
- Log structured JSON with correlation IDs.
- Example:

```typescript
this.logger.log({
  action: 'create_user',
  userId,
  email,
  timestamp: new Date(),
});
```

### Testing

- Mock Prisma in service tests.
- Use in-memory SQLite for integration tests.
- Maintain >80% coverage on core modules.

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

## 🚨 Anti-Patterns to Avoid

- ❌ Direct `process.env` access
- ❌ Business logic in controllers
- ❌ Raw Prisma calls outside repositories
- ❌ Hard deletes
- ❌ Console logs instead of structured logger
- ❌ Unvalidated DTOs
- ❌ Query overfetching (`findMany()` without `select`)
- ❌ Tight coupling between modules

---

## 🧱 Philosophy

This codebase should:

- Read like a **well-designed system**, not an accident that compiles.
- Prioritize **correctness**, **clarity**, and **maintainability** over speed.
- Enable any engineer—human or AI—to safely extend it without context loss.

## Instructions

For every task finished, run the linter and formatter, then build the project to ensure no errors.
Only finish tasks that pass all checks.
