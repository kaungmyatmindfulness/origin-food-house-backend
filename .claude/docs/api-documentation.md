# API Documentation Standards

## API CRUD Decorators

**ALWAYS use the API CRUD decorators from `src/common/decorators/api-crud.decorator.ts`:**

This project uses **reusable API documentation decorators** that bundle common Swagger patterns into single, expressive decorators.

### Available Decorators

**Error Response Decorators:**

| Decorator             | Includes           | Use Case                               |
| --------------------- | ------------------ | -------------------------------------- |
| `ApiStandardErrors()` | 400, 401, 403      | All authenticated endpoints            |
| `ApiResourceErrors()` | 400, 401, 403, 404 | Endpoints accessing specific resources |
| `ApiCreateErrors()`   | 400, 401, 403, 409 | POST create endpoints                  |
| `ApiDeleteErrors()`   | 400, 401, 403, 404 | DELETE endpoints                       |

**Authentication Decorators:**

| Decorator            | Includes                              | Use Case                    |
| -------------------- | ------------------------------------- | --------------------------- |
| `ApiAuth()`          | `@ApiBearerAuth` + 401 response       | Simple auth (no role check) |
| `ApiAuthWithRoles()` | `@ApiBearerAuth` + 401, 403 responses | Role-based access           |

**Parameter Decorators:**

| Decorator                         | Description                   |
| --------------------------------- | ----------------------------- |
| `ApiUuidParam(name, description)` | UUID path parameter           |
| `ApiStoreIdParam(description?)`   | Store ID parameter            |
| `ApiIdParam(description?)`        | Generic resource ID parameter |

**CRUD Decorators (Top-level resources):**

| Decorator                                         | HTTP              | Includes                                     |
| ------------------------------------------------- | ----------------- | -------------------------------------------- |
| `ApiGetAll<T>(model, resourceName, options?)`     | GET list          | Operation, success response (array)          |
| `ApiGetOne<T>(model, resourceName, options?)`     | GET single        | Operation, id param, success, 404            |
| `ApiGetOneAuth<T>(model, resourceName, options?)` | GET single (auth) | + auth, all errors                           |
| `ApiCreate<T>(model, resourceName, options?)`     | POST              | Operation, auth, 201 response, create errors |
| `ApiUpdate<T>(model, resourceName, options?)`     | PUT               | Operation, auth, id param, resource errors   |
| `ApiPatch<T>(model, resourceName, options?)`      | PATCH             | Operation, auth, id param, resource errors   |
| `ApiDelete<T>(model, resourceName, options?)`     | DELETE            | Operation, auth, id param, delete errors     |
| `ApiDeleteNoContent(resourceName, options?)`      | DELETE 204        | Same as above with 204 response              |

**Store-Nested Resource Decorators (for `/stores/:storeId/...`):**

| Decorator                                          | HTTP       | Includes        |
| -------------------------------------------------- | ---------- | --------------- |
| `ApiStoreGetAll<T>(model, resourceName, options?)` | GET list   | + storeId param |
| `ApiStoreGetOne<T>(model, resourceName, options?)` | GET single | + storeId param |
| `ApiStoreCreate<T>(model, resourceName, options?)` | POST       | + storeId param |
| `ApiStoreUpdate<T>(model, resourceName, options?)` | PUT        | + storeId param |
| `ApiStorePatch<T>(model, resourceName, options?)`  | PATCH      | + storeId param |
| `ApiStoreDelete<T>(model, resourceName, options?)` | DELETE     | + storeId param |
| `ApiStoreDeleteNoContent(resourceName, options?)`  | DELETE 204 | + storeId param |

**Special Decorators:**

| Decorator                                             | Use Case                                 |
| ----------------------------------------------------- | ---------------------------------------- |
| `ApiAction<T>(model, action, resourceName, options?)` | Action endpoints (approve, cancel, etc.) |
| `ApiPublicAction<T>(model, summary, description)`     | Public action endpoints                  |

### Usage Examples

```typescript
// OLD VERBOSE PATTERN - Don't use
@Post()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: "Create menu item (OWNER or ADMIN)" })
@ApiParam({ name: "storeId", description: "Store UUID", type: String })
@ApiUnauthorizedResponse({ description: "Authentication required" })
@ApiForbiddenResponse({ description: "Insufficient permissions" })
@ApiSuccessResponse(MenuItemDto, { status: HttpStatus.CREATED })
@ApiConflictResponse({ description: "Resource already exists" })
async create(@Body() dto: CreateMenuItemDto) {}

// NEW COMPACT PATTERN - Use this
@Post()
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.CREATED)
@ApiStoreCreate(MenuItemDto, "menu item", { roles: "OWNER or ADMIN" })
async create(@Body() dto: CreateMenuItemDto) {}
```

```typescript
// GET list (public)
@Get()
@ApiStoreGetAll(MenuItemResponseDto, "menu items")
async findAll(@Param("storeId") storeId: string) {}

// GET single (public)
@Get(":id")
@ApiStoreGetOne(MenuItemResponseDto, "menu item")
async findOne(@Param("id") id: string) {}

// PATCH (authenticated)
@Patch(":id")
@UseGuards(JwtAuthGuard)
@ApiStorePatch(MenuItemResponseDto, "menu item", { roles: "OWNER, ADMIN, or CHEF" })
async update(@Param("id") id: string, @Body() dto: UpdateMenuItemDto) {}

// DELETE with 204
@Delete(":id")
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.NO_CONTENT)
@ApiStoreDeleteNoContent("menu item", { roles: "OWNER or ADMIN" })
async remove(@Param("id") id: string) {}

// Action endpoint (e.g., approve, cancel)
@Post(":id/approve")
@UseGuards(JwtAuthGuard)
@ApiAction(PaymentResponseDto, "approve", "payment request", { roles: "PLATFORM_ADMIN" })
async approve(@Param("id") id: string) {}
```

### Options Object

All CRUD decorators accept an optional `options` object:

```typescript
interface ApiCrudOptions {
  summary?: string;        // Override auto-generated summary
  description?: string;    // Override success description
  roles?: string;          // Add roles to summary (e.g., "OWNER or ADMIN")
  idDescription?: string;  // Custom ID parameter description
  storeIdDescription?: string;  // Custom store ID description (store decorators)
}

// Example with options
@ApiStoreCreate(MenuItemDto, "menu item", {
  summary: "Create a new menu item with customizations",
  description: "Menu item created with all customization groups",
  roles: "OWNER or ADMIN",
})
```

### When to Use Raw Decorators

Use raw Swagger decorators when:
- Custom `@ApiBody` with examples is needed
- Complex query parameters (`@ApiQuery`)
- Custom headers (`@ApiHeader`)
- File upload endpoints (`@ApiConsumes`)
- Endpoints that don't fit CRUD patterns

```typescript
// Use raw decorators for complex cases
@Put(":id/translations")
@UseGuards(JwtAuthGuard)
@ApiAuthWithRoles()  // Still use this for auth
@ApiOperation({ summary: "Update menu item translations" })
@ApiBody({
  type: UpdateTranslationsDto,
  examples: {
    withDescriptions: { value: { translations: [...] } },
    namesOnly: { value: { translations: [...] } },
  },
})
@ApiSuccessResponse(String, "Translations updated successfully")
async updateTranslations(@Body() dto: UpdateTranslationsDto) {}
```

### Registering Response DTOs in extraModels (CRITICAL)

**IMPORTANT**: This project uses `@ApiSuccessResponse` decorator with `getSchemaPath()` to reference DTOs in a generic `StandardApiResponse<T>` wrapper. This pattern requires **manual registration** of Response DTOs.

**Why this is needed:**
- Input DTOs (`@Body()`, `@Query()`) are auto-discovered by NestJS Swagger
- Response DTOs referenced via `getSchemaPath()` are **NOT auto-discovered**
- Without registration, the OpenAPI spec will have `$ref` references to schemas that don't exist
- Frontend type generation will produce `unknown` types instead of properly typed DTOs

**When creating a new Response DTO:**

1. Create the DTO with `@ApiProperty()` decorators on all properties
2. **Add it to `extraModels` array in `src/main.ts`**

```typescript
// src/main.ts
const document = SwaggerModule.createDocument(app, config, {
  extraModels: [
    // Common
    StandardApiResponse,
    StandardApiErrorDetails,
    // Session
    SessionCreatedResponseDto,
    SessionResponseDto,
    // Cart
    CartResponseDto,
    CartItemResponseDto,
    // ... add your new DTO here
    MyNewResponseDto,  // Don't forget this step!
  ],
});
```

**DTO categories currently registered:**

| Category     | DTOs                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------- |
| Session      | `SessionCreatedResponseDto`, `SessionResponseDto`                                           |
| Cart         | `CartResponseDto`, `CartItemResponseDto`, `CartItemCustomizationResponseDto`                |
| Order        | `OrderResponseDto`, `OrderItemResponseDto`, `OrderItemCustomizationResponseDto`             |
| Kitchen      | `KitchenOrderResponseDto`                                                                   |
| Payment      | `PaymentResponseDto`, `RefundResponseDto`                                                   |
| Admin        | `ValidateAdminResponseDto`, `AdminUserResponseDto`, `AdminProfileResponseDto`, `AdminPermissionsResponseDto` |
| Reports      | `SalesSummaryDto`, `PaymentBreakdownDto`, `PaymentMethodBreakdownDto`, `PopularItemsDto`, `PopularItemDto`, `OrderStatusReportDto`, `OrderStatusCountDto` |
| Store        | `GetStoreDetailsResponseDto`, `StoreInformationResponseDto`, `StoreSettingResponseDto`      |
| Subscription | `SubscriptionResponseDto`, `TrialEligibilityResponseDto`, `TrialInfoResponseDto`, `PaymentRequestResponseDto`, `RefundRequestResponseDto`, `OwnershipTransferResponseDto` |

**Verification:**

After adding a new DTO, verify it appears in the OpenAPI spec:

```bash
npm run dev
curl -s http://localhost:3000/api-docs-json | jq '.components.schemas | keys[]' | grep "YourNewDto"
```

## REST API Design Conventions

**ALWAYS follow RESTful design principles for all API endpoints:**

### Resource Naming

```typescript
// CORRECT - Nouns (plural) for resource names
@Controller('stores')         // Plural noun
@Controller('menu-items')     // Plural noun, kebab-case
@Controller('orders')         // Plural noun

// INCORRECT - Verbs or singular forms
@Controller('getStores')      // Verb
@Controller('store')          // Singular
@Controller('CreateOrder')    // Verb + PascalCase
```

### HTTP Methods Semantic Usage

**ALWAYS use HTTP methods for their intended purpose:**

```typescript
// CORRECT - Semantic HTTP method usage
@Get('stores')                    // Read collection
@Get('stores/:id')                // Read single resource
@Post('stores')                   // Create new resource
@Patch('stores/:id')              // Partial update
@Put('stores/:id')                // Full replacement (rarely used)
@Delete('stores/:id')             // Soft delete (updates deletedAt)

// INCORRECT - Verbs in URLs
@Post('stores/create')            // Redundant - POST already means create
@Get('stores/getById/:id')        // Redundant - GET already means read
@Post('stores/:id/update')        // Should be PATCH
@Post('stores/:id/delete')        // Should be DELETE
```

### Hierarchical Resource Relationships

**ALWAYS use nested paths to show resource relationships:**

```typescript
// CORRECT - Hierarchical structure shows relationships
@Get('stores/:storeId/menu-items')              // Menu items belong to store
@Get('stores/:storeId/orders')                  // Orders belong to store
@Get('orders/:orderId/items')                   // Order items belong to order
@Get('stores/:storeId/users')                   // Store staff/members
@Post('stores/:storeId/menu-items')             // Create item in store context

// INCORRECT - Flat structure, unclear relationships
@Get('menu-items')                              // Which store?
@Get('menu-items/by-store/:storeId')            // Use nested route instead
@Post('menu-items/:storeId')                    // Confusing - ID should be in path
```

**Rules for nested resources:**
- Nest up to 2-3 levels maximum (avoid deep nesting)
- Use query parameters instead of deep nesting for filtering
- For complex relationships, consider separate endpoints

```typescript
// GOOD - 2 levels of nesting
GET /stores/:storeId/orders/:orderId

// ACCEPTABLE - 3 levels (maximum)
GET /stores/:storeId/orders/:orderId/items

// BAD - Too deep (4+ levels)
GET /stores/:storeId/orders/:orderId/items/:itemId/modifiers
// Better: GET /order-items/:itemId/modifiers
```

### Query Parameters for Filtering, Sorting, Pagination

**ALWAYS use query parameters for list operations:**

```typescript
// CORRECT - Query parameters for filtering, sorting, pagination
@Get('stores/:storeId/menu-items')
async getMenuItems(
  @Param('storeId') storeId: string,
  @Query('category') category?: string,           // Filter by category
  @Query('isActive') isActive?: boolean,          // Filter by status
  @Query('search') search?: string,               // Search by name
  @Query('sortBy') sortBy?: string,               // Sort field
  @Query('sortOrder') sortOrder?: 'asc' | 'desc', // Sort direction
  @Query('page') page?: number,                   // Page number
  @Query('limit') limit?: number,                 // Items per page
) {
  // Implementation
}

// Example requests:
// GET /stores/abc123/menu-items?category=appetizers
// GET /stores/abc123/menu-items?isActive=true&sortBy=price&sortOrder=asc
// GET /stores/abc123/menu-items?page=2&limit=20
// GET /stores/abc123/menu-items?search=pizza&category=main-course
```

**Standard query parameter conventions:**

```typescript
// Pagination
?page=1&limit=20              // Page-based pagination
?cursor=abc123&limit=20       // Cursor-based pagination

// Sorting
?sortBy=createdAt&sortOrder=desc
?sort=-createdAt              // Alternative: minus for descending

// Filtering
?status=ACTIVE                // Exact match
?minPrice=10&maxPrice=50      // Range
?tags=vegan,gluten-free       // Multiple values (comma-separated)

// Search
?search=pizza                 // Full-text search
?q=pizza                      // Alternative query param

// Field selection
?fields=id,name,price         // Return only specific fields
```

### HTTP Status Codes

**ALWAYS return appropriate HTTP status codes:**

```typescript
// CORRECT - Proper status codes
@Post('stores')
@HttpCode(HttpStatus.CREATED)        // 201 for resource creation
async create() { }

@Get('stores/:id')
// 200 OK by default for successful GET

@Patch('stores/:id')
// 200 OK by default for successful update

@Delete('stores/:id')
@HttpCode(HttpStatus.NO_CONTENT)    // 204 for successful deletion (no body)
async delete() { }

@Post('stores/:id/activate')
@HttpCode(HttpStatus.OK)            // 200 for action endpoints
async activate() { }

// Error responses (handled by NestJS exception filters)
throw new BadRequestException()     // 400 - Invalid input
throw new UnauthorizedException()   // 401 - Not authenticated
throw new ForbiddenException()      // 403 - Not authorized
throw new NotFoundException()       // 404 - Resource not found
throw new ConflictException()       // 409 - Duplicate resource
throw new InternalServerErrorException() // 500 - Server error
```

**Common status codes:**

- **2xx Success**
  - `200 OK` - Successful GET, PATCH, PUT, or action
  - `201 Created` - Successful POST (resource created)
  - `204 No Content` - Successful DELETE (no response body)

- **4xx Client Errors**
  - `400 Bad Request` - Invalid input/validation error
  - `401 Unauthorized` - Not authenticated
  - `403 Forbidden` - Authenticated but not authorized
  - `404 Not Found` - Resource doesn't exist
  - `409 Conflict` - Duplicate resource or constraint violation
  - `422 Unprocessable Entity` - Semantic validation error

- **5xx Server Errors**
  - `500 Internal Server Error` - Unexpected server error
  - `503 Service Unavailable` - Temporary unavailability

### Naming Conventions

**ALWAYS use camelCase for JSON properties (this project standard):**

```typescript
// CORRECT - camelCase for JSON properties
export class MenuItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  menuCategoryId: string; // camelCase

  @ApiProperty()
  isActive: boolean; // camelCase

  @ApiProperty()
  createdAt: Date; // camelCase
}

// INCORRECT - snake_case or PascalCase
export class MenuItemResponseDto {
  menu_category_id: string; // snake_case - don't use
  IsActive: boolean; // PascalCase - don't use
  created_at: Date; // snake_case - don't use
}
```

**URL path conventions:**

```typescript
// CORRECT - kebab-case for URL segments
@Controller('menu-items')
@Controller('active-table-sessions')
@Controller('payment-methods')

// INCORRECT - camelCase or snake_case in URLs
@Controller('menuItems')           // Don't use camelCase in URLs
@Controller('menu_items')          // Don't use snake_case in URLs
```

### REST API Checklist

Before marking API endpoints complete:

- [ ] Resource names are nouns (plural form)
- [ ] HTTP methods used semantically (GET/POST/PATCH/DELETE)
- [ ] Nested paths show resource relationships
- [ ] Query parameters for filtering/sorting/pagination
- [ ] camelCase for JSON properties, kebab-case for URL paths
- [ ] Appropriate HTTP status codes returned
- [ ] JSON response format (default)
- [ ] No verbs in URL paths (except necessary actions)
- [ ] Structured error responses with context
- [ ] Stateless design (all context in request)
- [ ] Swagger documentation for all endpoints
- [ ] No `Record<string, unknown>` in generated types (see section below)

## Preventing Record<string, unknown> in OpenAPI Generation

**CRITICAL**: When OpenAPI schemas use `additionalProperties: true`, frontend code generators produce `Record<string, unknown>` types, losing all type safety. This section covers patterns to prevent this.

### The Problem

```typescript
// BAD - Results in Record<string, unknown> in generated frontend types
@ApiPropertyOptional({
  type: "object",
  additionalProperties: true,  // <-- Loses type info!
  description: "Business hours configuration",
})
businessHours?: Record<string, unknown> | null;

// OpenAPI output:
// { "businessHours": { "type": "object", "additionalProperties": true } }
// Frontend generates: businessHours?: Record<string, unknown>
```

### Solution 1: Define Typed DTO for Object Values

**ALWAYS create a DTO class for structured objects:**

```typescript
// GOOD - Define the value type as a DTO
export class BusinessHoursSlotDto {
  @ApiProperty({ example: "09:00" })
  open: string;

  @ApiProperty({ example: "22:00" })
  close: string;

  @ApiProperty({ example: true })
  isOpen: boolean;
}

// In Response DTO - Use additionalProperties with $ref
@ApiPropertyOptional({
  type: "object",
  additionalProperties: {
    $ref: "#/components/schemas/BusinessHoursSlotDto",
  },
  description: "Business hours by day of week",
  example: { monday: { open: "09:00", close: "22:00", isOpen: true } },
})
businessHours?: Record<string, BusinessHoursSlotDto> | null;

// OpenAPI output:
// { "businessHours": { "type": "object", "additionalProperties": { "$ref": "..." } } }
// Frontend generates: businessHours?: Record<string, BusinessHoursSlotDto>
```

### Solution 2: Use Array Instead of Record for Known Keys

When the keys are from a known set (like days of week), use an array:

```typescript
// GOOD - Array with discriminator field instead of dynamic keys
export class BusinessHoursEntryDto {
  @ApiProperty({ enum: ['monday', 'tuesday', ...], example: "monday" })
  day: string;

  @ApiProperty({ example: "09:00" })
  open: string;

  @ApiProperty({ example: "22:00" })
  close: string;

  @ApiProperty({ example: true })
  isOpen: boolean;
}

// In Response DTO
@ApiProperty({ type: [BusinessHoursEntryDto] })
businessHours: BusinessHoursEntryDto[];

// Frontend generates: businessHours: BusinessHoursEntryDto[]
```

### Solution 3: Translation Maps Pattern

For locale-keyed objects (translation maps), use `additionalProperties` with `$ref`:

```typescript
// GOOD - Translation map with typed values
@ApiPropertyOptional({
  type: "object",
  additionalProperties: {
    $ref: "#/components/schemas/TranslationWithDescriptionResponseDto",
  },
  description: "Translations by locale code",
  example: {
    en: { locale: "en", name: "Pad Thai", description: "Thai noodles" },
    th: { locale: "th", name: "ผัดไทย", description: "..." },
  },
})
translations?: TranslationMap<TranslationWithDescriptionResponseDto>;

// Frontend generates: translations?: Record<string, TranslationWithDescriptionResponseDto>
```

### Solution 4: Inline Object Schema for Simple Cases

For simple objects with known properties, define inline schema:

```typescript
// GOOD - Inline schema for simple metadata
@ApiPropertyOptional({
  type: "object",
  properties: {
    width: { type: "number", example: 800 },
    height: { type: "number", example: 600 },
    format: { type: "string", example: "webp" },
  },
  description: "Image metadata",
})
metadata?: { width: number; height: number; format: string };

// Frontend generates typed object instead of Record<string, unknown>
```

### Patterns That Cause Record<string, unknown>

| Pattern | Problem | Solution |
|---------|---------|----------|
| `additionalProperties: true` | No value type constraint | Use `additionalProperties: { $ref: "..." }` |
| `type: "object"` alone | No schema for properties | Add `properties` or `additionalProperties` with schema |
| Generic `T` in wrapper class | OpenAPI can't resolve generics | Use `allOf` composition with `$ref` |
| `Record<string, any>` | TypeScript any propagates | Define explicit value DTO |

### DTOs Requiring Value Type Definitions

The following DTOs currently use `Record<string, unknown>` and need typed value DTOs:

| DTO | Field | Recommended Value DTO |
|-----|-------|----------------------|
| `StoreSettingResponseDto` | `businessHours` | `BusinessHoursSlotDto` |
| `StoreSettingResponseDto` | `specialHours` | `SpecialHoursEntryDto` |
| `PaymentResponseDto` | `splitMetadata` | `SplitMetadataDto` |
| `AuditLogResponseDto` | `details` | Use discriminated union by `action` |
| `UploadImageResponseDto` | `versions` | `ImageVersionMetadataDto` |

### Registration Requirement

**CRITICAL**: Value DTOs used in `additionalProperties.$ref` MUST be registered in `extraModels`:

```typescript
// src/main.ts
const document = SwaggerModule.createDocument(app, config, {
  extraModels: [
    // ... existing models
    BusinessHoursSlotDto,        // Required for $ref resolution
    SpecialHoursEntryDto,
    SplitMetadataDto,
    ImageVersionMetadataDto,
  ],
});
```

### Verification

After updating DTOs, verify no `Record<string, unknown>` in generated types:

```bash
# Generate OpenAPI spec
npm run dev &
sleep 5
curl -s http://localhost:3000/api-docs-json > openapi.json

# Check for additionalProperties: true (should be zero or minimal)
cat openapi.json | jq '.. | objects | select(.additionalProperties == true)' | wc -l

# Generate frontend types and search for unknown
npx openapi-typescript openapi.json -o types.ts
grep -c "Record<string, unknown>" types.ts  # Should be 0
```

### OpenAPI Type Safety Checklist

Before marking DTO work complete:

- [ ] No `additionalProperties: true` without typed schema
- [ ] All object fields have `properties` or `additionalProperties: { $ref }`
- [ ] Value DTOs registered in `extraModels`
- [ ] Frontend type generation produces no `Record<string, unknown>`
- [ ] Complex metadata uses discriminated unions or typed DTOs

### Exception: StandardApiResponse.data Field

The `StandardApiResponse<T>` generic wrapper class intentionally uses `additionalProperties: true` for its `data` field:

```typescript
// src/common/dto/standard-api-response.dto.ts
export class StandardApiResponse<T> {
  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,  // Intentional - resolved via allOf composition
    nullable: true,
  })
  data: T | null;
}
```

**Why this is acceptable:**

The `ApiSuccessResponse` decorator resolves the generic type using OpenAPI `allOf` composition:

```typescript
// src/common/decorators/api-success-response.decorator.ts
ResponseDecorator({
  schema: {
    allOf: [
      { $ref: getSchemaPath(StandardApiResponse) },  // Base wrapper
      {
        properties: {
          data: { $ref: getSchemaPath(model) },      // Specific DTO type
        },
      },
    ],
  },
});
```

**How it works:**

1. `StandardApiResponse` defines the wrapper structure (`status`, `data`, `message`, `errors`)
2. `ApiSuccessResponse(MenuItemDto)` creates an `allOf` composition
3. The `data` property is overridden with `$ref` to `MenuItemDto`
4. Frontend code generators see the composed schema with proper typing

**OpenAPI output for `GET /menu-items/:id`:**

```json
{
  "schema": {
    "allOf": [
      { "$ref": "#/components/schemas/StandardApiResponse" },
      {
        "properties": {
          "data": { "$ref": "#/components/schemas/MenuItemResponseDto" }
        }
      }
    ]
  }
}
```

**Frontend generated type:**

```typescript
// Properly typed, NOT Record<string, unknown>
interface GetMenuItemResponse {
  status: "success" | "error";
  data: MenuItemResponseDto | null;
  message: string | null;
  errors: StandardApiErrorDetails[] | null;
}
```

**Rules:**

- NEVER modify `StandardApiResponse.data` to use a specific type
- ALWAYS use `ApiSuccessResponse(YourDto)` decorator on endpoints
- The `allOf` composition properly resolves the generic type for code generation
- This is the ONLY acceptable use of `additionalProperties: true` in response DTOs
