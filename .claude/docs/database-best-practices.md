# PostgreSQL Best Practices (Prisma 7)

This section covers database patterns that work with **Prisma 7.0.0** and PostgreSQL.

## Schema Design Rules

**ALWAYS use proper field types:**

```prisma
// CORRECT - This project's pattern (uuid(7) for id)
model User {
  id        String   @id @default(uuid(7))
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
}

// CORRECT - Use ENUM for finite sets
enum Role {
  OWNER
  ADMIN
  CHEF
  CASHIER
  SERVER
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PREPARING
  READY
  COMPLETED
  CANCELLED
}

// CORRECT - Use Decimal for monetary values (not Float)
model Order {
  subtotal      Decimal @db.Decimal(10, 2)
  vatAmount     Decimal @db.Decimal(10, 2)
  serviceCharge Decimal @db.Decimal(10, 2)
  total         Decimal @db.Decimal(10, 2)
}

// CORRECT - Soft delete pattern
model MenuItem {
  id        String    @id @default(uuid(7))
  name      String
  deletedAt DateTime? // Null = active, non-null = deleted
}
```

**Rules:**
- ALWAYS use `uuid(7)` for primary keys (this project's standard, not `gen_random_uuid()`)
- ALWAYS use `DateTime` fields (Prisma handles timezone conversion)
- ALWAYS use Prisma ENUMs instead of raw strings for finite sets
- ALWAYS use `Decimal` type for prices, amounts, financial calculations
- ALWAYS include `createdAt` and `updatedAt` for audit trails
- ALWAYS use `deletedAt: DateTime?` for soft deletes (not boolean flags)

## Indexing Best Practices

**ALWAYS index foreign keys and frequently queried fields:**

```prisma
model Order {
  id        String   @id @default(uuid(7))
  storeId   String
  userId    String
  status    OrderStatus
  createdAt DateTime @default(now())

  store Store @relation(fields: [storeId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  // Index foreign keys for JOIN performance
  @@index([storeId])
  @@index([userId])

  // Index frequently filtered fields
  @@index([status])

  // Composite index for common query patterns
  @@index([storeId, status, createdAt])

  // Partial index for soft deletes (if applicable)
  @@index([storeId], where: { deletedAt: null })
}
```

**Indexing rules:**
- ALWAYS index foreign keys (`storeId`, `userId`, etc.)
- ALWAYS index fields used in `WHERE` clauses frequently
- CREATE composite indexes with filter columns first, then sort columns
- CREATE partial indexes for soft-deleted entities when appropriate
- AVOID over-indexing (each index has write cost)

## Transaction Best Practices

**ALWAYS use transactions for multi-step operations:**

```typescript
// CORRECT - Atomic transaction
async createStore(userId: string, dto: CreateStoreDto): Promise<Store> {
  return await this.prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: { slug: dto.slug },
    });

    await tx.storeInformation.create({
      data: { storeId: store.id, name: dto.name, ...dto },
    });

    await tx.storeSetting.create({
      data: { storeId: store.id, currency: 'USD', vatRate: 0 },
    });

    await tx.userStore.create({
      data: { userId, storeId: store.id, role: 'OWNER' },
    });

    return store;
  });
}

// INCORRECT - Non-atomic operations (data inconsistency risk)
async createStore(userId: string, dto: CreateStoreDto) {
  const store = await this.prisma.store.create({ data: { slug: dto.slug } });
  await this.prisma.storeInformation.create({ data: { storeId: store.id, ...dto } });
  // If this fails, store exists but no information - inconsistent state!
  return store;
}
```

**Transaction rules:**
- ALWAYS wrap multiple related CREATE/UPDATE operations in `$transaction`
- USE `FOR UPDATE` pattern for race condition prevention (inventory, balance checks):
  ```typescript
  await tx.$queryRaw`SELECT * FROM accounts WHERE id = ${id} FOR UPDATE`;
  ```
- DEFAULT isolation level (`READ COMMITTED`) is sufficient for most operations
- CONSIDER `Serializable` isolation for critical financial operations

## Migration Best Practices

**ALWAYS handle migrations safely:**

```bash
# Development - interactive migrations
npm run migrate:db

# Production - deploy migrations separately
npx prisma migrate deploy

# NEVER modify existing migrations
# Instead, create a new migration

# Safe column removal (multi-step deployment)
# Step 1: Mark column unused, deploy code that doesn't read it
# Step 2: Create migration to drop column
# Step 3: Deploy migration
```

**Migration rules:**
- NEVER modify existing migration files (create new ones)
- NEVER drop columns without deprecation period:
  1. Stop writing to column
  2. Deploy code that doesn't read column
  3. Create migration to drop column
  4. Deploy migration
- ALWAYS test migrations on staging database first
- ALWAYS backup production before running migrations
- CREATE migrations with descriptive names
- USE `prisma migrate dev` in development (interactive)
- USE `prisma migrate deploy` in production (non-interactive)

## Connection Pool Configuration

**ALWAYS configure proper connection pooling:**

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Prisma connection pool (configured via DATABASE_URL)
// postgresql://user:password@localhost:5432/mydb?connection_limit=10&pool_timeout=20

// For API servers:
connection_limit=10        // Max 10 connections
pool_timeout=20            // 20 second timeout

// For background job workers:
connection_limit=20-50     // Higher for parallel jobs
```

**Connection pool rules:**
- API servers: 10 connections (per instance)
- Background workers: 20-50 connections
- NEVER exceed PostgreSQL max_connections (typically 100)
- USE connection pooler (PgBouncer) for >100 concurrent users
- MONITOR connection usage with `SHOW pool_status` (if using PgBouncer)

## Error Recovery & Resilience

**ALWAYS handle transient failures:**

```typescript
// CORRECT - Retry logic for transient failures
async function createOrderWithRetry(
  dto: CreateOrderDto,
  maxRetries = 3,
): Promise<Order> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.createOrder(dto);
    } catch (error) {
      lastError = error;

      // Retry only on transient errors
      if (this.isTransientError(error) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 100; // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        this.logger.warn(`Retrying order creation (attempt ${attempt + 1}/${maxRetries})`);
        continue;
      }

      // Non-transient error or max retries exceeded
      throw error;
    }
  }

  throw lastError;
}

private isTransientError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Connection errors, timeouts
    return ['P1001', 'P1002', 'P1008', 'P1017'].includes(error.code);
  }
  return false;
}
```

## UPSERT Pattern (Instead of Manual Check)

**ALWAYS use UPSERT for idempotent operations:**

```typescript
// INCORRECT - Race condition risk
async updateOrCreateUserStore(userId: string, storeId: string, role: Role) {
  const existing = await this.prisma.userStore.findUnique({
    where: { userId_storeId: { userId, storeId } },
  });

  if (existing) {
    return this.prisma.userStore.update({
      where: { id: existing.id },
      data: { role },
    });
  } else {
    return this.prisma.userStore.create({
      data: { userId, storeId, role },
    });
  }
}

// CORRECT - Atomic UPSERT
async updateOrCreateUserStore(userId: string, storeId: string, role: Role) {
  return this.prisma.userStore.upsert({
    where: { userId_storeId: { userId, storeId } },
    update: { role },
    create: { userId, storeId, role },
  });
}
```

## Isolation Level Considerations

**UNDERSTAND when to use different isolation levels:**

```typescript
// Default: READ COMMITTED (sufficient for most operations)
await this.prisma.order.create({ data: dto });

// Use SERIALIZABLE for critical financial operations
await this.prisma.$transaction(
  async (tx) => {
    // Check account balance
    const account = await tx.account.findUnique({ where: { id } });

    if (account.balance < amount) {
      throw new BadRequestException("Insufficient funds");
    }

    // Deduct balance
    await tx.account.update({
      where: { id },
      data: { balance: account.balance - amount },
    });

    // Record transaction
    await tx.transaction.create({ data: { accountId: id, amount } });
  },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  },
);
```

**Isolation level guidelines:**
- `READ COMMITTED` (default): Most operations
- `REPEATABLE READ`: Reporting, analytics (consistent snapshot)
- `SERIALIZABLE`: Financial transactions, inventory updates (prevent race conditions)
