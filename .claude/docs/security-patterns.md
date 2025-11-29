# Critical Security Patterns

## Resolved Vulnerabilities (Reference Only)

**P0 Critical Issues** - Fixed as of 2025-11-29. See [Security Audit](docs/security-audit/2025-10-28-comprehensive-security-audit.md) for historical context.

### 1. WebSocket Authentication Bypass (CVSS 9.1) - FIXED
- **Location**: `src/cart/cart.gateway.ts:68-150`
- **Original Issue**: No authentication guards
- **Resolution**: `handleConnection` now validates session token OR JWT, disconnects unauthenticated clients

### 2. Session Token Exposure (CVSS 8.9) - FIXED
- **Location**: `src/active-table-session/active-table-session.controller.ts`
- **Original Issue**: Returns `sessionToken` in API response
- **Resolution**: `mapToSessionResponse()` strips token from all responses; token only returned on creation via `SessionCreatedResponseDto`

### 3. Checkout Authentication Bypass (CVSS 8.6) - FIXED
- **Location**: `src/order/order.service.ts:51-109`
- **Original Issue**: Missing authentication guard
- **Resolution**: Dual auth validation - validates session token against stored value AND staff JWT with `checkStorePermission()`

### 4. Missing Store Isolation (CVSS 7.8) - FIXED
- **Location**: `src/active-table-session/active-table-session.service.ts:354-450`
- **Original Issue**: No `storeId` validation
- **Resolution**: `update()` and `close()` verify store permission using `session.storeId` for both table and manual sessions

## Secure Patterns

**ALWAYS follow these security patterns:**

### 1. Validate Store Ownership

```typescript
async checkStoreMembership(userId: string, storeId: string): Promise<void> {
  const membership = await this.prisma.userStore.findFirst({
    where: { userId, storeId },
  });

  if (!membership) {
    throw new ForbiddenException('Access denied to this store');
  }
}
```

### 2. Sanitize DTOs Before Database Operations - IMPLEMENTED

**Status**: Implemented across all input DTOs as of 2025-11-29.

All user-facing string fields now use `@Transform(({ value }) => value?.trim())` for input sanitization:
- Category DTOs (create, update, upsert)
- Menu Item DTOs (create, update)
- Customization Group/Option DTOs
- Table DTOs (create, update)
- Store DTOs (create, update)
- Session DTOs (manual session)
- Order DTOs (apply discount)
- Translation DTOs (base, with description)
- Subscription DTOs (refund request, verify/reject payment)
- Admin DTOs (suspend user)
- Payment DTOs (record payment)
- Audit Log DTOs

```typescript
class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim()) // Sanitize input
  name: string;
}
```

### 3. Use Parameterized Queries

```typescript
// NEVER construct raw SQL with string interpolation
await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`; // SQL injection risk

// ALWAYS use Prisma's typed queries
await prisma.user.findUnique({ where: { id: userId } });
```

### 4. Hash Sensitive Data

```typescript
import * as bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(password, 10);
```

### 5. Validate File Uploads

```typescript
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
  throw new BadRequestException('Invalid file type');
}
```

## Database Security

**ALWAYS follow security best practices:**

```typescript
// CORRECT - Prisma uses prepared statements automatically
const user = await this.prisma.user.findUnique({
  where: { email: userEmail }, // Safe - parameterized
});

// CAUTION - Raw queries (only when necessary)
const result = await this.prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`; // Still safe - Prisma parameterizes

// DANGEROUS - String interpolation (SQL injection risk)
const result = await this.prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${email}'`, // NEVER DO THIS
);
```

**Security rules:**
- PREFER Prisma's type-safe queries (automatic SQL injection protection)
- USE `$queryRaw` with template literals (parameterized) if raw SQL needed
- NEVER use `$queryRawUnsafe` with user input
- NEVER concatenate user input into SQL strings
- STORE secrets in environment variables (use `ConfigService`)
- USE read-only database user for read-heavy operations (if separate pools)

## Authentication & Authorization Checklist

Before marking security-related code complete:

- [x] Authentication guards applied (`@UseGuards(JwtAuthGuard)`)
- [x] Authorization verified (role checks before privileged operations)
- [x] Store isolation enforced (multi-tenancy)
- [x] Input validation with class-validator decorators
- [x] DTO sanitization with `@Transform(({ value }) => value?.trim())`
- [x] No SQL injection vulnerabilities (Prisma parameterized queries)
- [x] Sensitive data not exposed in responses
- [x] Session tokens not exposed in API responses
- [x] WebSocket connections authenticated
- [x] File uploads validated (type, size)
- [x] Secrets stored in environment variables
