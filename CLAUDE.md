# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Origin Food House Backend is a **multi-tenant restaurant management platform** built with NestJS, Prisma 7 ORM, and PostgreSQL. The system supports POS (Point of Sale) operations, Kitchen Display Systems (KDS), customer self-ordering via QR codes, payment processing, and subscription management.

**Tech Stack**: NestJS 11 + Prisma 7.0.0 + PostgreSQL + TypeScript 5.9

**Status**: Development (v0.0.1) - NOT production-ready due to critical security vulnerabilities and test failures.

---

## Development Commands

### Essential Commands

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

### Quality Gates (Every Completion)

Before marking ANY task as complete, you MUST run these commands in sequence and ALL must succeed:

```bash
npm run format              # 1. Format code
npm run lint                # 2. Lint passes
npm run typecheck           # 3. Type check passes
npm test                    # 4. All tests pass
npm run build               # 5. Build succeeds
```

**CRITICAL**: If any of these commands fail, the task is NOT complete. Fix all errors before proceeding.

---

## Clean Code Rules

### 1. TypeScript Strictness

**ALWAYS enforce strict typing:**

```typescript
// L BAD - implicit any, unsafe operations
function processData(data) {
  return data.items.map((item) => item.value);
}

//  GOOD - explicit types, null safety
function processData(data: DataResponse): ProcessedItem[] {
  if (!data?.items) {
    throw new BadRequestException("Items array is required");
  }
  return data.items.map((item) => item.value);
}
```

**Rules:**

- NEVER use `any` type (ESLint warns, but fix it)
- NEVER use non-null assertion (`!`) without null check first
- ALWAYS handle null/undefined cases explicitly
- ALWAYS use optional chaining (`?.`) and nullish coalescing (`??`)
- ALWAYS validate external data (user input, API responses)
- ALWAYS use explicit & narrow types (use union types like `'OWNER' | 'ADMIN'` instead of `string`)
- ALWAYS use discriminated unions for type-safe branching logic
- ALWAYS make fields `readonly` when they shouldn't be reassigned
- PREFER composition over inheritance (use dependency injection, not class hierarchies)
- PREFER default values over optional parameters: `function getConfig(env = 'dev')` instead of `env?: string`

**Type Safety Patterns:**

```typescript
// ✅ GOOD - Narrow union types instead of string
type UserRole = "OWNER" | "ADMIN" | "CHEF" | "CASHIER" | "SERVER";
type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED";

// ✅ GOOD - Discriminated unions for type-safe branching
type PaymentResult =
  | { success: true; transactionId: string }
  | { success: false; error: string };

function handlePayment(result: PaymentResult) {
  if (result.success) {
    // TypeScript knows transactionId exists here
    this.logger.log(`Payment successful: ${result.transactionId}`);
  } else {
    // TypeScript knows error exists here
    this.logger.error(`Payment failed: ${result.error}`);
  }
}

// ✅ GOOD - Readonly for immutability
class CreateOrderDto {
  readonly items: readonly OrderItemDto[];
  readonly storeId: string;
}

// ✅ GOOD - Pure functions for business logic (no side effects)
// Side effects belong in services, not logic helpers
function calculateOrderTotal(items: OrderItem[]): Decimal {
  return items.reduce(
    (sum, item) => sum.add(item.price.mul(item.quantity)),
    new Decimal(0),
  );
}
```

### 2. Error Handling

**ALWAYS use typed exceptions and standardized patterns:**

```typescript
// L BAD - generic errors, no logging
async findUser(id: string) {
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('Not found');
  return user;
}

//  GOOD - typed exceptions, structured logging, error context
async findUser(id: string): Promise<User> {
  const method = this.findUser.name;
  this.logger.log(`[${method}] Fetching user with ID: ${id}`);

  try {
    return await this.prisma.user.findUniqueOrThrow({
      where: { id },
    });
  } catch (error) {
    this.logger.error(
      `[${method}] Failed to fetch user ${id}`,
      getErrorDetails(error),
    );

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    throw new InternalServerErrorException(
      'An unexpected error occurred while fetching user',
    );
  }
}
```

**Rules:**

- ALWAYS use NestJS exception classes (`NotFoundException`, `BadRequestException`, etc.)
- ALWAYS log errors with context (method name, relevant IDs, error details)
- ALWAYS use `getErrorDetails(error)` utility for error logging
- ALWAYS catch Prisma errors and convert to HTTP exceptions
- ALWAYS provide user-friendly error messages (never expose internal details)

### 3. Logging Standards

**ALWAYS use structured logging with method context:**

```typescript
// L BAD - no context, inconsistent format
this.logger.log('Creating store');
this.logger.log(`Store created: ${store.id}`);

//  GOOD - method name prefix, operation tracking
async createStore(userId: string, dto: CreateStoreDto): Promise<Store> {
  const method = this.createStore.name;
  this.logger.log(`[${method}] Creating store for user ${userId}`);

  try {
    const store = await this.prisma.store.create({ data: dto });
    this.logger.log(`[${method}] Store created successfully: ${store.id}`);
    return store;
  } catch (error) {
    this.logger.error(`[${method}] Store creation failed`, getErrorDetails(error));
    throw error;
  }
}
```

**Rules:**

- ALWAYS prefix logs with `[${method}]` using `const method = this.methodName.name`
- ALWAYS log at method entry with key parameters (user ID, entity ID)
- ALWAYS log success with created/updated entity IDs
- ALWAYS log errors with `getErrorDetails(error)` utility
- NEVER use `console.log` (ESLint error) - use `this.logger` instead

### 4. Database Operations

**ALWAYS use transactions for multi-step operations:**

```typescript
// L BAD - non-atomic operations, data inconsistency risk
async createStore(userId: string, dto: CreateStoreDto) {
  const store = await this.prisma.store.create({ data: { slug: dto.slug } });
  await this.prisma.storeInformation.create({ data: { storeId: store.id, ...dto } });
  await this.prisma.userStore.create({ data: { userId, storeId: store.id, role: 'OWNER' } });
  return store;
}

//  GOOD - atomic transaction, rollback on failure
async createStore(userId: string, dto: CreateStoreDto): Promise<Store> {
  const method = this.createStore.name;

  return await this.prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: { slug: dto.slug },
    });

    await tx.storeInformation.create({
      data: { storeId: store.id, ...dto },
    });

    await tx.userStore.create({
      data: { userId, storeId: store.id, role: 'OWNER' },
    });

    this.logger.log(`[${method}] Store created: ${store.id}`);
    return store;
  });
}
```

**Rules:**

- ALWAYS use `$transaction` for operations creating multiple related entities
- ALWAYS use `findUniqueOrThrow` instead of `findUnique` + null check when entity must exist
- ALWAYS include `where: { deletedAt: null }` for soft-deleted entities
- ALWAYS use Decimal type for monetary values (prices, amounts)
- ALWAYS add indexes for foreign keys and frequently queried fields

### 5. Authentication & Authorization

**ALWAYS validate user permissions before operations:**

```typescript
// L BAD - no authorization, direct operation
@Patch(':id')
async updateStore(@Param('id') storeId: string, @Body() dto: UpdateStoreDto) {
  return this.storeService.update(storeId, dto);
}

//  GOOD - JWT auth, role-based access control, ownership verification
@Patch(':id')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Update store information (OWNER/ADMIN only)' })
async updateStore(
  @Param('id') storeId: string,
  @GetUser('userId') userId: string,
  @Body() dto: UpdateStoreDto,
) {
  // Service method verifies OWNER/ADMIN role
  return this.storeService.update(userId, storeId, dto);
}

// In service:
async update(userId: string, storeId: string, dto: UpdateStoreDto) {
  await this.checkUserRole(userId, storeId, ['OWNER', 'ADMIN']);
  // ... update logic
}
```

**Rules:**

- ALWAYS use `@UseGuards(JwtAuthGuard)` on protected routes
- ALWAYS verify user role before privileged operations (use `checkUserRole` helper)
- ALWAYS validate store membership before accessing store data
- ALWAYS use `@GetUser('userId')` decorator to extract authenticated user
- ALWAYS use session tokens OR JWT for cart/order operations (dual auth support)
- NEVER expose session tokens in API responses (security vulnerability)

### 6. Input Validation

**ALWAYS validate all DTOs with class-validator:**

```typescript
// L BAD - inline DTO without validation (no type safety, no runtime validation)
@Patch(':id')
async updateItem(
  @Param('id') id: string,
  @Body() dto: { isActive?: boolean; name?: string },
) {
  return this.service.update(id, dto);
}

// L BAD - no validation, unsafe input
export class CreateMenuItemDto {
  name: string;
  price: number;
  storeId: string;
}

//  GOOD - comprehensive validation, API documentation
export class CreateMenuItemDto {
  @ApiProperty({ description: "Menu item name", example: "Margherita Pizza" })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: "Price in store currency", example: 12.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiProperty({ description: "Store UUID", example: "abc123..." })
  @IsUUID()
  storeId: string;

  @ApiPropertyOptional({ description: "Item description" })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
```

**Rules:**

- ALWAYS use class-validator decorators on all DTO properties
- ALWAYS add `@ApiProperty` or `@ApiPropertyOptional` for Swagger docs
- ALWAYS validate string lengths (`@MinLength`, `@MaxLength`)
- ALWAYS validate number ranges (`@Min`, `@Max`, `maxDecimalPlaces` for decimals)
- ALWAYS use `@IsUUID` for ID fields, `@IsEmail` for emails
- ALWAYS mark optional fields with `@IsOptional()` and `?` type
- NEVER use inline DTO definitions (e.g., `@Body() dto: { field?: string }`). ALWAYS create a separate DTO class file in the `dto/` directory with proper validation decorators

### 7. API Documentation

**ALWAYS document endpoints with Swagger decorators:**

```typescript
// L BAD - no documentation, unclear response
@Get(':id')
async getStore(@Param('id') id: string) {
  return this.storeService.findOne(id);
}

//  GOOD - documented operation, response schema, error cases
@Get(':id')
@Public() // Custom decorator indicating no auth required
@ApiOperation({ summary: 'Get public store details' })
@ApiParam({ name: 'id', description: 'Store UUID' })
@ApiOkResponse({
  description: 'Store details retrieved successfully',
  type: StoreResponseDto,
})
@ApiNotFoundResponse({ description: 'Store not found' })
async getStore(@Param('id') id: string): Promise<StoreResponseDto> {
  return this.storeService.findOne(id);
}
```

**Rules:**

- ALWAYS use `@ApiOperation` to describe endpoint purpose
- ALWAYS use `@ApiParam`, `@ApiQuery`, `@ApiBody` for input documentation
- ALWAYS use `@ApiOkResponse`, `@ApiCreatedResponse` with DTO types
- ALWAYS document error responses (`@ApiNotFoundResponse`, `@ApiBadRequestResponse`, etc.)
- ALWAYS create response DTOs (don't expose Prisma entities directly)

### 8. Testing Requirements

**ALWAYS write tests for new code (target: 85% coverage):**

```typescript
describe("StoreService", () => {
  let service: StoreService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        StoreService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuditLogService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
  });

  describe("createStore", () => {
    it("should create store with information and settings in transaction", async () => {
      const dto: CreateStoreDto = { name: "Test Store", slug: "test-store" };
      const userId = "user-123";

      prismaMock.$transaction.mockImplementation((callback) =>
        callback(prismaMock),
      );

      const result = await service.createStore(userId, dto);

      expect(result).toBeDefined();
      expect(prismaMock.store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: dto.slug }),
        }),
      );
    });

    it("should throw BadRequestException for duplicate slug", async () => {
      prismaMock.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "5.0.0",
        }),
      );

      await expect(service.createStore("user-123", dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
```

**Rules:**

- ALWAYS write unit tests for service methods (aim for 85%+ coverage)
- ALWAYS mock Prisma with `createPrismaMock()` helper
- ALWAYS test both success and error cases
- ALWAYS test transaction rollback on failures
- ALWAYS test authorization checks
- ALWAYS test input validation via DTO tests

---

## Prisma 7 Migration & Configuration

This project uses **Prisma 7.0.0**, which introduced significant architectural changes. The migration was completed successfully with the following configuration.

### Key Prisma 7 Features Used

**1. New Configuration File (`prisma.config.ts`)**

Prisma 7 introduces a TypeScript-based configuration file that replaces the previous approach:

```typescript
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node --transpile-only prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

**2. Driver Architecture with `@prisma/adapter-pg`**

Prisma 7 uses a new driver-based architecture with adapters. This project uses the PostgreSQL adapter:

```typescript
// src/prisma/prisma.service.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "src/generated/prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>("DATABASE_URL");
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Benefits of the adapter pattern:**

- Direct connection pooling via `pg` library
- Better performance and control over database connections
- Flexibility to swap database drivers without changing application code

**3. Custom Client Output Path**

The Prisma client is generated to a custom location for better project organization:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma/client"
}
```

Import pattern:

```typescript
import { PrismaClient } from "src/generated/prisma/client";
```

### TypeScript Configuration for Prisma 7

**Important**: Despite Prisma 7 documentation mentioning "esnext", the project successfully uses **CommonJS** output:

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
    // ... other options
  }
}
```

**Why CommonJS works with Prisma 7:**

- Prisma 7's "esnext" requirement refers to TypeScript's ability to understand modern import syntax during compilation
- The final compiled JavaScript output can be CommonJS
- ES modules in Node.js would require adding `.js` extensions to all imports (not practical for large codebases)
- NestJS standard configuration (CommonJS) is fully compatible with Prisma 7

### Prisma 7 Best Practices

**DO:**

- ✅ Use the `@prisma/adapter-pg` driver for PostgreSQL
- ✅ Configure connection pooling via the `pg` library's `Pool`
- ✅ Use `prisma.config.ts` for centralized configuration
- ✅ Keep TypeScript configuration as `module: "commonjs"` for NestJS projects
- ✅ Extend `PrismaClient` in your service class for proper lifecycle management

**DON'T:**

- ❌ Don't switch to ES modules unless absolutely necessary (requires extensive refactoring)
- ❌ Don't use the old `PrismaClient` constructor without adapters (deprecated in Prisma 7)
- ❌ Don't skip the `onModuleInit` and `onModuleDestroy` lifecycle hooks
- ❌ Don't access Prisma client before it's connected (`$connect()` in `onModuleInit`)

### Package Versions

Current Prisma 7 setup:

```json
{
  "@prisma/adapter-pg": "^7.0.0",
  "@prisma/client": "^7.0.0",
  "prisma": "^7.0.0",
  "pg": "^8.13.1"
}
```

---

## NestJS Architecture Rules

### Module Organization

**ALWAYS keep modules small and domain-focused:**

```
✅ GOOD - Domain-focused modules
src/
├── auth/           # Authentication & authorization
├── store/          # Store management
├── menu/           # Menu items & pricing
├── order/          # Order processing
├── payment/        # Payment & refunds
├── kitchen/        # Kitchen Display System
├── subscription/   # Billing & tiers
└── common/         # Shared utilities

❌ BAD - Technical-focused modules
src/
├── controllers/
├── services/
├── repositories/
└── helpers/
```

**Each module MUST contain:**

- **Controller** (HTTP endpoints)
- **Service** (business logic & use cases)
- **DTOs** (input/output contracts)
- **Module file** (dependency wiring)
- **Tests** (unit & integration tests)

**Optional but recommended:**

- **Gateway** (WebSocket for real-time features)
- **Types** (custom TypeScript types)
- **Constants** (module-specific constants)

### Controller Best Practices

**Controllers MUST NOT contain business logic:**

```typescript
// ❌ BAD - Business logic in controller
@Post()
async createUser(@Body() body: any) {
  const hashed = await bcrypt.hash(body.password, 10);
  const user = await this.prisma.user.create({
    data: { ...body, password: hashed },
  });
  return user;
}

// ✅ GOOD - Controller delegates to service
@Post()
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Create new user' })
@ApiCreatedResponse({ type: UserResponseDto })
async createUser(
  @Body() dto: CreateUserDto,
  @GetUser('userId') currentUserId: string,
): Promise<UserResponseDto> {
  return this.userService.create(currentUserId, dto);
}
```

**Controller responsibilities (ONLY):**

1. Request validation (automatic via DTOs)
2. Authentication/authorization (via guards)
3. Call appropriate service method
4. Return response (with proper HTTP status codes)

**Controllers MUST NOT:**

- Access database directly (use services)
- Contain business logic (delegate to services)
- Hash passwords, calculate totals, etc. (belongs in services)
- Handle errors manually (use exception filters)

### Service Layer Best Practices

**Services MUST be stateless:**

```typescript
// ❌ BAD - Stateful service (caching, mutable state)
@Injectable()
export class StoreService {
  private cachedStores = new Map(); // ❌ Don't do this

  async findOne(id: string) {
    if (this.cachedStores.has(id)) {
      return this.cachedStores.get(id);
    }
    const store = await this.prisma.store.findUnique({ where: { id } });
    this.cachedStores.set(id, store);
    return store;
  }
}

// ✅ GOOD - Stateless service, caching externalized
@Injectable()
export class StoreService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService, // Use Redis for caching
  ) {}

  async findOne(id: string): Promise<Store> {
    const cacheKey = `store:${id}`;
    const cached = await this.cacheService.get<Store>(cacheKey);
    if (cached) return cached;

    const store = await this.prisma.store.findUniqueOrThrow({ where: { id } });
    await this.cacheService.set(cacheKey, store, 300); // 5 min TTL
    return store;
  }
}
```

**Service responsibilities:**

- Orchestrate business logic
- Manage transactions
- Enforce domain rules
- Call Prisma for persistence
- Emit events for side effects

**Services MUST:**

- Be injected (never use `new StoreService()`)
- Return DTOs or mapped objects (not always Prisma entities directly, but acceptable in this project)
- Handle all error cases with typed exceptions
- Use transactions for multi-step operations

### Dependency Injection Best Practices

**ALWAYS use constructor injection:**

```typescript
// ✅ CORRECT - Constructor injection
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}
}

// ❌ INCORRECT - No static helpers or singletons
export class OrderHelper {
  static calculateTotal(items: OrderItem[]) {
    // ❌ Don't do this
    // ...
  }
}

// ✅ CORRECT - Injectable utility service
@Injectable()
export class OrderCalculationService {
  calculateTotal(items: OrderItem[]): Decimal {
    // ...
  }
}
```

**Injection patterns in this project:**

- Use `PrismaService` directly (no repository abstraction layer)
- Use `ConfigService` for all environment variables (never `process.env` directly)
- Inject all dependencies through constructor (no property injection)

### Avoiding Circular Dependencies

**NEVER use `forwardRef()` - refactor instead:**

```typescript
// ❌ BAD - Circular dependency
@Module({
  imports: [forwardRef(() => StoreModule)],
})
export class UserModule {}

// ✅ GOOD - Extract shared logic to common module
@Module({
  imports: [CommonModule], // Both User and Store import Common
})
export class UserModule {}
```

**Strategies to avoid circular dependencies:**

1. Extract shared logic to a common/shared module
2. Use events (EventEmitter) for cross-module communication
3. Restructure modules to have clear dependency direction
4. Consider if modules are too tightly coupled (design smell)

## Architecture Patterns

### Multi-Tenancy

**Store Isolation**: All data operations MUST be scoped to a specific store.

```typescript
//  CORRECT - Store-scoped query
async getMenuItems(storeId: string) {
  return this.prisma.menuItem.findMany({
    where: {
      storeId,
      deletedAt: null,
    },
  });
}

// L INCORRECT - Cross-store data leak
async getMenuItems() {
  return this.prisma.menuItem.findMany(); // Returns items from ALL stores
}
```

**Rules:**

- ALWAYS filter by `storeId` in queries
- ALWAYS verify user has access to the store before operations
- ALWAYS include store context in audit logs

### Soft Deletes

**NEVER hard delete records** - use soft deletes for audit trails:

```typescript
//  CORRECT - Soft delete
async deleteMenuItem(id: string) {
  return this.prisma.menuItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// L INCORRECT - Hard delete (loses audit trail)
async deleteMenuItem(id: string) {
  return this.prisma.menuItem.delete({ where: { id } });
}
```

**Rules:**

- ALWAYS use `deletedAt` timestamp for deletions
- ALWAYS exclude soft-deleted records with `where: { deletedAt: null }`
- NEVER use `prisma.model.delete()` except for test cleanup

### Real-Time Features (WebSocket)

**CRITICAL SECURITY**: WebSocket gateways MUST authenticate connections.

```typescript
// L CRITICAL VULNERABILITY - No authentication (existing code has this issue)
@WebSocketGateway()
export class CartGateway {
  @SubscribeMessage("cart:add")
  async handleAddItem(client: Socket, data: any) {
    // Anyone can manipulate any cart!
  }
}

//  CORRECT - Authenticated WebSocket (MUST implement)
@WebSocketGateway()
export class CartGateway implements OnGatewayConnection {
  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    if (!token) {
      client.disconnect();
      return;
    }

    const user = await this.authService.validateToken(token);
    if (!user) {
      client.disconnect();
      return;
    }

    client.data.userId = user.id;
  }

  @SubscribeMessage("cart:add")
  async handleAddItem(client: Socket, data: AddCartItemDto) {
    const userId = client.data.userId;
    // ... validated operation
  }
}
```

**Rules:**

- ALWAYS validate authentication in `handleConnection`
- ALWAYS disconnect unauthenticated clients
- ALWAYS validate DTOs for WebSocket messages
- ALWAYS emit to specific rooms (session-based or store-based)

### Role-Based Access Control (RBAC)

**5 Roles**: OWNER, ADMIN, CHEF, CASHIER, SERVER

```typescript
// Role hierarchy and permissions
const ROLE_PERMISSIONS = {
  OWNER: ['*'], // Full access
  ADMIN: ['store:update', 'user:invite', 'menu:manage', 'settings:update'],
  CHEF: ['menu:manage', 'order:view', 'order:update-status'],
  CASHIER: ['order:view', 'payment:create', 'payment:refund'],
  SERVER: ['order:create', 'table:manage'],
};

//  Usage in service
async updateStoreSettings(userId: string, storeId: string, dto: UpdateSettingsDto) {
  await this.checkUserRole(userId, storeId, ['OWNER', 'ADMIN']);
  // ... update logic
}
```

**Rules:**

- ALWAYS verify role before privileged operations
- ALWAYS use `checkUserRole` helper method
- OWNER and ADMIN can manage store settings
- CHEF can update menu and order statuses
- CASHIER can process payments
- SERVER can create orders and manage tables

### Image Storage & Multi-Size System

**CRITICAL**: This project uses **path-based image storage**, NOT full URLs in the database.

#### Architecture Overview

**Backend stores**: Base S3 paths (e.g., `"uploads/abc-123-def"`)
**Frontend constructs**: Full URLs with size suffix (e.g., `baseUrl + path + "-medium.webp"`)
**Benefits**: Zero backend bandwidth, easy CDN integration, flexible infrastructure

#### Database Fields

```typescript
// ✅ CORRECT - Store base paths
model MenuItem {
  imagePath String?  // "uploads/abc-123-def" (no version suffix, no URL)
}

model StoreInformation {
  logoPath       String?  // "uploads/logo-456"
  coverPhotoPath String?  // "uploads/cover-789"
}

// ❌ INCORRECT - Don't store full URLs
model MenuItem {
  imageUrl String?  // "https://bucket.s3.amazonaws.com/uploads/abc-medium.webp" ← NO!
}
```

#### Upload Service Returns Paths

```typescript
// ✅ CORRECT - UploadService returns base path
const uploadResult = await this.uploadService.uploadImage(file, "menu-item");
// Returns: { basePath: "uploads/abc-123", availableSizes: ["small", "medium", "large"] }

await this.prisma.menuItem.create({
  data: {
    imagePath: uploadResult.basePath, // Store base path only
  },
});

// ❌ INCORRECT - Don't construct or store URLs
await this.prisma.menuItem.create({
  data: {
    imagePath: `https://bucket.s3.amazonaws.com/${uploadResult.basePath}-medium.webp`, // ← NO!
  },
});
```

#### Available Image Sizes

**Image Size Presets** (defined in `src/common/upload/types/image-size-config.type.ts`):

| Preset          | Sizes Generated                               | Primary  | File Pattern                                   |
| --------------- | --------------------------------------------- | -------- | ---------------------------------------------- |
| `menu-item`     | small (400px), medium (800px), large (1200px) | medium   | `uploads/uuid-{size}.webp`                     |
| `store-logo`    | small (200px), medium (400px)                 | medium   | `uploads/uuid-{size}.webp`                     |
| `cover-photo`   | small (400px), medium (800px), large (1200px) | large    | `uploads/uuid-{size}.webp`                     |
| `payment-proof` | original (no resize)                          | original | `payment-proofs/{storeId}/uuid-original.{ext}` |

#### Upload Flow

```typescript
// 1. Upload image
const uploadResult = await this.uploadService.uploadImage(file, "menu-item");
// Returns:
// {
//   basePath: "uploads/abc-123-def",
//   availableSizes: ["small", "medium", "large"],
//   primarySize: "medium",
//   metadata: { originalWidth: 1920, versions: {...} }
// }

// 2. Store base path in database
await this.prisma.menuItem.create({
  data: {
    name: "Pad Thai",
    imagePath: uploadResult.basePath, // ← Just the base path
  },
});

// 3. API returns base path to frontend
return {
  id: "item-123",
  name: "Pad Thai",
  imagePath: "uploads/abc-123-def", // ← Frontend constructs URLs
};
```

#### Input Validation

**ALWAYS use `@IsImagePath()` validator for image fields:**

```typescript
// ✅ CORRECT - Validate base path format
import { IsImagePath } from "src/common/validators/is-image-path.validator";

export class CreateMenuItemDto {
  @IsOptional()
  @IsString()
  @IsImagePath()
  imagePath?: string; // Validates: "uploads/abc-123" or "payment-proofs/store/uuid"
}

// ❌ INCORRECT - Don't use URL validator for paths
import { IsS3ImageUrl } from "src/common/validators/is-s3-image-url.validator";

export class CreateMenuItemDto {
  @IsS3ImageUrl() // ← NO! This expects full HTTPS URLs
  imagePath?: string;
}
```

#### Path Utilities

**Use helper functions from `src/common/utils/image-path.util.ts`:**

```typescript
import {
  getVersionPath,
  isValidImagePath,
} from "src/common/utils/image-path.util";

// Check if path is valid
if (isValidImagePath("uploads/abc-123")) {
  // Valid base path
}

// Construct version-specific path (internal use only)
const mediumPath = getVersionPath("uploads/abc-123", "medium");
// Returns: "uploads/abc-123-medium.webp"
```

#### Image Upload Rules

- ALWAYS return `basePath` from upload service (not full URLs)
- ALWAYS store base paths in database (e.g., `"uploads/uuid"`)
- NEVER store version suffixes in database (no `-small`, `-medium`, `-large`)
- NEVER store full URLs in database
- ALWAYS use `@IsImagePath()` validator for input DTOs
- ALWAYS document in API responses that paths require frontend URL construction

#### Cleanup Service Pattern

```typescript
// Cleanup service uses base paths
const menuItems = await this.prisma.menuItem.findMany({
  where: { imagePath: { not: null } },
  select: { imagePath: true },
});

// imagePath is already the base path: "uploads/uuid"
menuItems.forEach((item) => {
  if (item.imagePath) {
    usedBasePaths.add(item.imagePath); // No extraction needed
  }
});
```

---

## Critical Security Patterns

### Known Vulnerabilities (DO NOT REPLICATE)

**P0 Critical Issues** - See [Security Audit](docs/security-audit/2025-10-28-comprehensive-security-audit.md):

1. **WebSocket Authentication Bypass** (CVSS 9.1)
   - Location: `src/cart/cart.gateway.ts`
   - Issue: No authentication guards
   - Fix: Implement `handleConnection` with token validation

2. **Session Token Exposure** (CVSS 8.9)
   - Location: `src/active-table-session/active-table-session.controller.ts`
   - Issue: Returns `sessionToken` in API response
   - Fix: Remove `sessionToken` from response DTOs, return only in Set-Cookie header

3. **Checkout Authentication Bypass** (CVSS 8.6)
   - Location: `src/cart/cart.controller.ts:checkout`
   - Issue: Missing authentication guard
   - Fix: Add `@UseGuards(JwtAuthGuard)` or session token validation

4. **Missing Store Isolation** (CVSS 7.8)
   - Location: `src/active-table-session/active-table-session.service.ts`
   - Issue: No `storeId` validation
   - Fix: Always verify `tableId` belongs to user's `storeId`

### Secure Patterns

**ALWAYS follow these security patterns:**

```typescript
// 1. Validate store ownership
async checkStoreMembership(userId: string, storeId: string): Promise<void> {
  const membership = await this.prisma.userStore.findFirst({
    where: { userId, storeId },
  });

  if (!membership) {
    throw new ForbiddenException('Access denied to this store');
  }
}

// 2. Sanitize DTOs before database operations
class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value.trim()) // Sanitize input
  name: string;
}

// 3. Use parameterized queries (Prisma does this automatically)
// L NEVER construct raw SQL with string interpolation
await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`; // SQL injection risk

//  ALWAYS use Prisma's typed queries
await prisma.user.findUnique({ where: { id: userId } });

// 4. Hash sensitive data
import * as bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(password, 10);

// 5. Validate file uploads
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
  throw new BadRequestException('Invalid file type');
}
```

---

## Code Style & Formatting

### Prettier Configuration

**Implicit configuration** (using Prettier defaults):

- Single quotes for strings
- 2 spaces indentation
- Semicolons required
- Trailing commas in multi-line

### ESLint Rules (Key Enforcements)

```typescript
// 1. Nullish coalescing over OR
const value = config ?? "default"; // 
const value = config || "default"; // L

// 2. Optional chaining
const name = user?.profile?.name; // 
const name = user && user.profile && user.profile.name; // L

// 3. No floating promises
await this.service.doSomething(); // 
this.service.doSomething(); // L ESLint error

// 4. Prefer const
const items = []; // 
let items = []; // L (if never reassigned)

// 5. Template literals
const message = `User ${userId} created`; // 
const message = "User " + userId + " created"; // L

// 6. Import order (enforced by eslint-plugin-import)
// 1. Built-in modules (fs, path)
// 2. External modules (@nestjs/common)
// 3. Internal modules (src/...)
// 4. Parent/sibling imports (../, ./)
// With blank lines between groups, alphabetically sorted
```

### Naming Conventions

```typescript
// Classes: PascalCase
class StoreService {}
class CreateStoreDto {}

// Interfaces/Types: PascalCase with descriptive names
interface StoreWithDetails {}
type TransactionClient = ...;

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_ROLES = ['OWNER', 'ADMIN'] as const;

// Variables/Functions: camelCase
const userId = 'abc123';
async function createStore() {}

// Private methods: camelCase with descriptive names
private async validateStoreAccess() {}

// Boolean variables: is/has/can prefix
const isAuthenticated = true;
const hasPermission = false;
const canDelete = user.role === 'OWNER';

// Enum values: UPPER_CASE (Prisma convention)
enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  CHEF = 'CHEF',
}

// Database fields: camelCase (Prisma convention)
model User {
  firstName String  // camelCase
  lastName  String
  createdAt DateTime
}
```

**File naming conventions:**

```
✅ CORRECT naming patterns:
store.service.ts           # Service
store.controller.ts        # Controller
store.module.ts            # Module
store.service.spec.ts      # Unit test
create-store.dto.ts        # DTO (kebab-case)
store-response.dto.ts      # Response DTO
jwt-auth.guard.ts          # Guard
roles.decorator.ts         # Decorator
prisma-mock.helper.ts      # Test helper

❌ INCORRECT patterns:
StoreService.ts            # Don't use PascalCase for files
store_service.ts           # Don't use snake_case
storeService.ts            # Don't use camelCase
```

---

## File Structure & Organization

### Module Structure

```
src/
   <feature>/
      dto/                      # Data Transfer Objects
         create-<entity>.dto.ts
         update-<entity>.dto.ts
         <entity>-response.dto.ts
      <feature>.controller.ts   # API endpoints
      <feature>.service.ts      # Business logic
      <feature>.service.spec.ts # Unit tests
      <feature>.module.ts       # NestJS module
      <feature>.gateway.ts      # WebSocket (if applicable)
   common/                       # Shared utilities
      decorators/               # Custom decorators
      guards/                   # Auth guards
      utils/                    # Helper functions
      testing/                  # Test utilities
   prisma/
       schema.prisma             # Database schema
       migrations/               # Migration files
       seed.ts                   # Seed data
```

### Import Path Rules

```typescript
//  CORRECT - Use absolute paths with 'src/' prefix
import { PrismaService } from "src/prisma/prisma.service";
import { AuthService } from "src/auth/auth.service";

// L INCORRECT - Relative paths for cross-module imports
import { PrismaService } from "../../prisma/prisma.service";
```

---

## Documentation Requirements

### JSDoc Comments

**ALWAYS document public methods:**

```typescript
/**
 * Creates a new store with initial information and settings.
 *
 * This operation is transactional - if any step fails, all changes are rolled back.
 * The creating user is automatically assigned as OWNER.
 *
 * @param userId - Auth0 ID of the user creating the store
 * @param dto - Store creation data (name, slug, contact info)
 * @returns Created store with nested information and settings
 * @throws {BadRequestException} If slug is already taken
 * @throws {InternalServerErrorException} On unexpected database errors
 */
async createStore(
  userId: string,
  dto: CreateStoreDto,
): Promise<StoreWithDetailsPayload> {
  // Implementation...
}
```

**Rules:**

- ALWAYS document public service methods
- ALWAYS describe parameters with `@param`
- ALWAYS describe return value with `@returns`
- ALWAYS document exceptions with `@throws`
- ALWAYS explain complex business logic in comments

---

## PostgreSQL Best Practices (Prisma 7)

This section covers database patterns that work with **Prisma 7.0.0** and PostgreSQL.

### Schema Design Rules

**ALWAYS use proper field types:**

```prisma
// ✅ CORRECT - This project's pattern (uuid(7) for shorter UUIDs)
model User {
  id        String   @id @default(uuid(7))
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
}

// ✅ CORRECT - Use ENUM for finite sets
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

// ✅ CORRECT - Use Decimal for monetary values (not Float)
model Order {
  subtotal      Decimal @db.Decimal(10, 2)
  vatAmount     Decimal @db.Decimal(10, 2)
  serviceCharge Decimal @db.Decimal(10, 2)
  total         Decimal @db.Decimal(10, 2)
}

// ✅ CORRECT - Soft delete pattern
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

### Indexing Best Practices

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

  // ✅ Index foreign keys for JOIN performance
  @@index([storeId])
  @@index([userId])

  // ✅ Index frequently filtered fields
  @@index([status])

  // ✅ Composite index for common query patterns
  @@index([storeId, status, createdAt])

  // ✅ Partial index for soft deletes (if applicable)
  @@index([storeId], where: { deletedAt: null })
}
```

**Indexing rules:**

- ALWAYS index foreign keys (`storeId`, `userId`, etc.)
- ALWAYS index fields used in `WHERE` clauses frequently
- CREATE composite indexes with filter columns first, then sort columns
- CREATE partial indexes for soft-deleted entities when appropriate
- AVOID over-indexing (each index has write cost)

### Transaction Best Practices

**ALWAYS use transactions for multi-step operations:**

```typescript
// ✅ CORRECT - Atomic transaction
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

// ❌ INCORRECT - Non-atomic operations (data inconsistency risk)
async createStore(userId: string, dto: CreateStoreDto) {
  const store = await this.prisma.store.create({ data: { slug: dto.slug } });
  await this.prisma.storeInformation.create({ data: { storeId: store.id, ...dto } });
  // If this fails, store exists but no information → inconsistent state!
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

### Database Security

**ALWAYS follow security best practices:**

```typescript
// ✅ CORRECT - Prisma uses prepared statements automatically
const user = await this.prisma.user.findUnique({
  where: { email: userEmail }, // Safe - parameterized
});

// ⚠️ CAUTION - Raw queries (only when necessary)
const result = await this.prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`; // Still safe - Prisma parameterizes

// ❌ DANGEROUS - String interpolation (SQL injection risk)
const result = await this.prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${email}'`, // ❌ NEVER DO THIS
);
```

**Security rules:**

- PREFER Prisma's type-safe queries (automatic SQL injection protection)
- USE `$queryRaw` with template literals (parameterized) if raw SQL needed
- NEVER use `$queryRawUnsafe` with user input
- NEVER concatenate user input into SQL strings
- STORE secrets in environment variables (use `ConfigService`)
- USE read-only database user for read-heavy operations (if separate pools)

### Migration Best Practices

**ALWAYS handle migrations safely:**

```bash
# ✅ Development - interactive migrations
npm run migrate:db

# ✅ Production - deploy migrations separately
npx prisma migrate deploy

# ❌ NEVER modify existing migrations
# Instead, create a new migration

# ✅ Safe column removal (multi-step deployment)
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

---

## Performance Considerations

### Database Queries

```typescript
//  EFFICIENT - Select only needed fields
const users = await this.prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
  },
});

// L INEFFICIENT - Fetches all fields including large text
const users = await this.prisma.user.findMany();

//  EFFICIENT - Use cursor-based pagination for large datasets
const items = await this.prisma.menuItem.findMany({
  take: 20,
  skip: 1,
  cursor: { id: lastItemId },
});

// L INEFFICIENT - Offset pagination on large tables
const items = await this.prisma.menuItem.findMany({
  skip: 10000,
  take: 20,
});
```

### Caching Strategy

**ALWAYS use Redis for caching (not in-memory or database caching):**

```typescript
// ✅ CORRECT - Redis caching for frequently accessed, rarely changed data
@Injectable()
export class StoreService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async getStoreDetails(storeId: string): Promise<Store> {
    const cacheKey = `store:${storeId}`;
    const cached = await this.cacheService.get<Store>(cacheKey);

    if (cached) {
      this.logger.log(`Cache hit for store: ${storeId}`);
      return cached;
    }

    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      include: { information: true, setting: true },
    });

    await this.cacheService.set(cacheKey, store, 300); // 5 min TTL
    return store;
  }
}
```

**Cache Invalidation Pattern:**

```typescript
// ✅ CORRECT - Invalidate cache after mutations
async updateStore(storeId: string, dto: UpdateStoreDto): Promise<Store> {
  const store = await this.prisma.store.update({
    where: { id: storeId },
    data: dto,
  });

  // Invalidate all related cache keys
  await this.cacheService.del(`store:${storeId}`);
  await this.cacheService.del(`store:${storeId}:menu`);
  await this.cacheService.del(`store:${storeId}:categories`);

  return store;
}

// ✅ CORRECT - Cache with pattern-based invalidation
async invalidateStoreCache(storeId: string): Promise<void> {
  const pattern = `store:${storeId}:*`;
  await this.cacheService.deletePattern(pattern);
}
```

**Caching rules:**

- ALWAYS use Redis (never in-memory caching in services)
- CACHE read-heavy, write-light data (store details, menu items)
- SET appropriate TTL (Time To Live):
  - 5-15 minutes for frequently changing data
  - 1-24 hours for static data
- INVALIDATE cache on every mutation
- USE pattern-based cache keys: `entity:id:subresource`
- NEVER cache user-specific sensitive data without proper isolation

---

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

---

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

---

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

---

## Additional Resources

- **Master Refactoring Plan**: [docs/MASTER_REFACTORING_PLAN.md](docs/MASTER_REFACTORING_PLAN.md)
- **Security Audit**: [docs/security-audit/2025-10-28-comprehensive-security-audit.md](docs/security-audit/2025-10-28-comprehensive-security-audit.md)
- **Architecture Review**: [docs/solution-architect/architecture/2025-10-28-comprehensive-architecture-review.md](docs/solution-architect/architecture/2025-10-28-comprehensive-architecture-review.md)
- **Auth0 Integration**: [docs/AUTH0_INTEGRATION.md](docs/AUTH0_INTEGRATION.md)
- **API Docs**: `http://localhost:3000/api/docs` (when server running)

---

## Summary: Quality Checklist

Before marking ANY task complete:

- [ ] Code formatted (`npm run format`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Tests written and passing (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Error handling with typed exceptions
- [ ] Structured logging with `[method]` prefix
- [ ] Input validation with class-validator
- [ ] Authentication/authorization guards applied
- [ ] Store isolation enforced (multi-tenancy)
- [ ] Soft deletes used (no hard deletes)
- [ ] Transactions for multi-step DB operations
- [ ] Swagger documentation added
- [ ] JSDoc comments on public methods
- [ ] No security vulnerabilities introduced

**If ANY item fails, the task is NOT complete.**

---

## Advanced Clean Code Patterns

### Data Mapping: Database → Domain → API

**ALWAYS maintain separation of concerns:**

```typescript
// Layer 1: Prisma Model (Persistence)
// Generated by Prisma - represents database schema

// Layer 2: Domain Entity (optional - for complex business logic)
export class Order {
  constructor(
    private readonly id: string,
    private readonly items: OrderItem[],
    private readonly status: OrderStatus,
  ) {}

  calculateTotal(): Decimal {
    return this.items.reduce(
      (sum, item) => sum.add(item.price.mul(item.quantity)),
      new Decimal(0),
    );
  }

  canBeCancelled(): boolean {
    return this.status === "PENDING" || this.status === "CONFIRMED";
  }
}

// Layer 3: Response DTO (API Contract)
export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty({ type: "number" })
  total: string; // Decimal as string for JSON

  @ApiProperty()
  status: OrderStatus;

  @ApiProperty()
  createdAt: Date;
}
```

**Mapping pattern in service:**

```typescript
@Injectable()
export class OrderService {
  async findOne(orderId: string): Promise<OrderResponseDto> {
    // 1. Fetch from database (Prisma model)
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    // 2. Convert to domain entity (if needed for business logic)
    const orderEntity = new Order(order.id, order.items, order.status);
    const total = orderEntity.calculateTotal();

    // 3. Map to DTO (API response)
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      total: total.toString(),
      status: order.status,
      createdAt: order.createdAt,
    };
  }
}
```

**When to use each layer:**

- **Prisma Models**: ALWAYS (database operations)
- **Domain Entities**: ONLY when you have complex business rules that belong to the entity
- **DTOs**: ALWAYS for API input/output

**This project's pattern:**

- Often returns Prisma entities directly (acceptable for simple cases)
- Uses DTOs for input validation
- Consider adding domain entities for complex business logic (order calculations, payment processing)

### Connection Pool Configuration

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

### Error Recovery & Resilience

**ALWAYS handle transient failures:**

```typescript
// ✅ CORRECT - Retry logic for transient failures
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

### UPSERT Pattern (Instead of Manual Check)

**ALWAYS use UPSERT for idempotent operations:**

```typescript
// ❌ INCORRECT - Race condition risk
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

// ✅ CORRECT - Atomic UPSERT
async updateOrCreateUserStore(userId: string, storeId: string, role: Role) {
  return this.prisma.userStore.upsert({
    where: { userId_storeId: { userId, storeId } },
    update: { role },
    create: { userId, storeId, role },
  });
}
```

### Isolation Level Considerations

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

---

## Summary: Comprehensive Quality Checklist

Before marking ANY task complete, verify ALL of the following:

### Code Quality

- [ ] Code formatted (`npm run format`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Tests written and passing (`npm test`)
- [ ] Build succeeds (`npm run build`)

### TypeScript Best Practices

- [ ] No `any` types used
- [ ] Explicit return types on all functions
- [ ] Null/undefined handled with optional chaining (`?.`) and nullish coalescing (`??`)
- [ ] Union types used instead of broad string/number types
- [ ] Pure functions for business logic (side effects isolated to services)

### NestJS Architecture

- [ ] Controllers contain ONLY request/response handling
- [ ] Business logic in services (not controllers)
- [ ] DTOs used for all input/output
- [ ] Dependency injection used (no static methods)
- [ ] No circular dependencies (`forwardRef` not used)

### Database & Prisma

- [ ] Transactions used for multi-step operations
- [ ] Soft deletes used (no hard deletes)
- [ ] Indexes added for foreign keys and frequently queried fields
- [ ] `findUniqueOrThrow` used instead of `findUnique` + null check
- [ ] Decimal type used for monetary values

### Security

- [ ] Authentication guards applied (`@UseGuards(JwtAuthGuard)`)
- [ ] Authorization verified (role checks before privileged operations)
- [ ] Store isolation enforced (multi-tenancy)
- [ ] Input validation with class-validator decorators
- [ ] No SQL injection vulnerabilities (Prisma parameterized queries)
- [ ] Sensitive data not exposed in responses

### Documentation & Logging

- [ ] Swagger documentation added (`@ApiOperation`, `@ApiResponse`)
- [ ] JSDoc comments on public methods
- [ ] Structured logging with `[method]` prefix
- [ ] Error handling with typed exceptions
- [ ] `getErrorDetails(error)` used for error logging

### Performance

- [ ] SELECT only needed fields (not `SELECT *`)
- [ ] Pagination implemented for large datasets
- [ ] Redis caching for read-heavy operations
- [ ] Connection pool configured appropriately
- [ ] N+1 query problem avoided (use `include` or `select`)

**If ANY item fails, the task is NOT complete.**
