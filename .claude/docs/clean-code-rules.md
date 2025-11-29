# Clean Code Rules

## 1. TypeScript Strictness

**ALWAYS enforce strict typing:**

```typescript
// BAD - implicit any, unsafe operations
function processData(data) {
  return data.items.map((item) => item.value);
}

// GOOD - explicit types, null safety
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
// GOOD - Narrow union types instead of string
type UserRole = "OWNER" | "ADMIN" | "CHEF" | "CASHIER" | "SERVER";
type OrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED";

// GOOD - Discriminated unions for type-safe branching
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

// GOOD - Readonly for immutability
class CreateOrderDto {
  readonly items: readonly OrderItemDto[];
  readonly storeId: string;
}

// GOOD - Pure functions for business logic (no side effects)
function calculateOrderTotal(items: OrderItem[]): Decimal {
  return items.reduce(
    (sum, item) => sum.add(item.price.mul(item.quantity)),
    new Decimal(0),
  );
}
```

## 2. Error Handling

**ALWAYS use typed exceptions and standardized patterns:**

```typescript
// BAD - generic errors, no logging
async findUser(id: string) {
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('Not found');
  return user;
}

// GOOD - typed exceptions, structured logging, error context
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

## 3. Logging Standards

**ALWAYS use structured logging with method context:**

```typescript
// BAD - no context, inconsistent format
this.logger.log('Creating store');
this.logger.log(`Store created: ${store.id}`);

// GOOD - method name prefix, operation tracking
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

## 4. Database Operations

**ALWAYS use transactions for multi-step operations:**

```typescript
// BAD - non-atomic operations, data inconsistency risk
async createStore(userId: string, dto: CreateStoreDto) {
  const store = await this.prisma.store.create({ data: { slug: dto.slug } });
  await this.prisma.storeInformation.create({ data: { storeId: store.id, ...dto } });
  await this.prisma.userStore.create({ data: { userId, storeId: store.id, role: 'OWNER' } });
  return store;
}

// GOOD - atomic transaction, rollback on failure
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

## 5. Authentication & Authorization

**ALWAYS validate user permissions before operations:**

```typescript
// BAD - no authorization, direct operation
@Patch(':id')
async updateStore(@Param('id') storeId: string, @Body() dto: UpdateStoreDto) {
  return this.storeService.update(storeId, dto);
}

// GOOD - JWT auth, role-based access control, ownership verification
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

## 6. Input Validation

**ALWAYS validate all DTOs with class-validator:**

```typescript
// BAD - inline DTO without validation (no type safety, no runtime validation)
@Patch(':id')
async updateItem(
  @Param('id') id: string,
  @Body() dto: { isActive?: boolean; name?: string },
) {
  return this.service.update(id, dto);
}

// BAD - no validation, unsafe input
export class CreateMenuItemDto {
  name: string;
  price: number;
  storeId: string;
}

// GOOD - comprehensive validation, API documentation
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

## 7. Testing Requirements

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
