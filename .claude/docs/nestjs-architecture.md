# NestJS Architecture Rules

## Module Organization

**ALWAYS keep modules small and domain-focused:**

```
GOOD - Domain-focused modules
src/
├── auth/           # Authentication & authorization
├── store/          # Store management
├── menu/           # Menu items & pricing
├── order/          # Order processing
├── payment/        # Payment & refunds
├── kitchen/        # Kitchen Display System
├── subscription/   # Billing & tiers
└── common/         # Shared utilities

BAD - Technical-focused modules
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

## Controller Best Practices

**Controllers MUST NOT contain business logic:**

```typescript
// BAD - Business logic in controller
@Post()
async createUser(@Body() body: any) {
  const hashed = await bcrypt.hash(body.password, 10);
  const user = await this.prisma.user.create({
    data: { ...body, password: hashed },
  });
  return user;
}

// GOOD - Controller delegates to service
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

## Service Layer Best Practices

**Services MUST be stateless:**

```typescript
// BAD - Stateful service (caching, mutable state)
@Injectable()
export class StoreService {
  private cachedStores = new Map(); // Don't do this

  async findOne(id: string) {
    if (this.cachedStores.has(id)) {
      return this.cachedStores.get(id);
    }
    const store = await this.prisma.store.findUnique({ where: { id } });
    this.cachedStores.set(id, store);
    return store;
  }
}

// GOOD - Stateless service, caching externalized
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

## Dependency Injection Best Practices

**ALWAYS use constructor injection:**

```typescript
// CORRECT - Constructor injection
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}
}

// INCORRECT - No static helpers or singletons
export class OrderHelper {
  static calculateTotal(items: OrderItem[]) {
    // Don't do this
    // ...
  }
}

// CORRECT - Injectable utility service
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

## Avoiding Circular Dependencies

**NEVER use `forwardRef()` - refactor instead:**

```typescript
// BAD - Circular dependency
@Module({
  imports: [forwardRef(() => StoreModule)],
})
export class UserModule {}

// GOOD - Extract shared logic to common module
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

## Service Delegation Pattern

**ALWAYS delegate entity operations to their owning service:**

When one service needs to create/update/delete entities owned by another domain, delegate to that domain's service instead of using Prisma directly.

```typescript
// BAD - StoreService directly creates categories
@Injectable()
export class StoreService {
  async createStore(dto: CreateStoreDto) {
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data: dto });
      // Direct Prisma call for category creation
      await tx.category.createMany({
        data: [{ name: "Appetizers", storeId: store.id }],
      });
      return store;
    });
  }
}

// GOOD - StoreService delegates to CategoryService
@Injectable()
export class StoreService {
  constructor(
    private categoryService: CategoryService,
    private tableService: TableService,
    private menuService: MenuService,
  ) {}

  async createStore(dto: CreateStoreDto) {
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data: dto });
      // Delegate to CategoryService with transaction client
      await this.categoryService.createBulkForSeeding(
        tx,
        store.id,
        DEFAULT_CATEGORIES,
      );
      await this.tableService.createBulkForSeeding(
        tx,
        store.id,
        DEFAULT_TABLES,
      );
      return store;
    });
  }
}
```

**Service delegation rules:**
1. **Single Responsibility**: Each service handles its own domain entities
2. **Transaction Support**: Seeding methods accept `tx: TransactionClient` for atomicity
3. **RBAC Bypass**: Seeding methods skip authorization (system operations)
4. **Reusable Logic**: Entity creation logic is centralized in one place

**Seeding method naming convention:**

```typescript
// For bulk creation during store seeding (no RBAC)
async createBulkForSeeding(
  tx: TransactionClient,
  storeId: string,
  data: SeedInput[],
): Promise<Map<string, string>>

// For user-initiated creation (with RBAC)
async create(
  userId: string,
  storeId: string,
  dto: CreateDto,
): Promise<Entity>
```

**When to delegate vs direct Prisma:**

| Scenario                             | Approach                           |
| ------------------------------------ | ---------------------------------- |
| Creating entities for another domain | Delegate to owning service         |
| Querying own domain entities         | Use Prisma directly                |
| Seeding default data                 | Use seeding methods with tx client |
| User-initiated CRUD                  | Use standard service methods       |

## File Structure & Organization

### Module Structure

```
src/
   <feature>/
      dto/                      # Data Transfer Objects
         create-<entity>.dto.ts
         update-<entity>.dto.ts
         <entity>-response.dto.ts
      <feature>.controller.ts   # API endpoints
      <feature>.service.ts      # Business logic
      <feature>.service.spec.ts # Unit tests
      <feature>.module.ts       # NestJS module
      <feature>.gateway.ts      # WebSocket (if applicable)
   common/                       # Shared utilities
      decorators/               # Custom decorators
      guards/                   # Auth guards
      utils/                    # Helper functions
      testing/                  # Test utilities
   prisma/
       schema.prisma             # Database schema
       migrations/               # Migration files
       seed.ts                   # Seed data
```

### Import Path Rules

```typescript
// CORRECT - Use absolute paths with 'src/' prefix
import { PrismaService } from "src/prisma/prisma.service";
import { AuthService } from "src/auth/auth.service";

// INCORRECT - Relative paths for cross-module imports
import { PrismaService } from "../../prisma/prisma.service";
```

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
