# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Origin Food House is a multi-tenant restaurant management system built with NestJS, Prisma ORM, and PostgreSQL. The system handles restaurant operations including menu management, table sessions, orders, and payment processing.

## Development Commands

### Database Operations
```bash
npm run migrate:db      # Run Prisma migrations
npm run generate:db     # Generate Prisma client
npm run studio:db       # Open Prisma Studio GUI
npm run seed:db         # Seed database with demo data (owner@test.com/test1234)
npm run reset:db        # Reset database (removes all data)
npm run drop:db         # Drop and recreate database schema
```

### Development & Build
```bash
npm run dev             # Start development server with hot reload (port 3000)
npm run build           # Build for production
npm run start:prod      # Start production server
npm run lint            # Run ESLint with auto-fix
npm run format          # Format code with Prettier
```

### Testing
```bash
npm run test            # Run unit tests
npm run test:watch      # Run tests in watch mode
npm run test:cov        # Generate test coverage report
npm run test:e2e        # Run end-to-end tests
```

### Utilities
```bash
npm run sync:postman    # Sync Postman collection
```

## Architecture & Key Patterns

### Multi-Store Architecture
Every entity is scoped to a store. Always include `storeId` in queries to ensure data isolation:
```typescript
where: { storeId, deletedAt: null }
```

### Transaction Pattern for Nested Operations
Use transactions for multi-step operations, especially with nested creates/updates:
```typescript
await this.prisma.$transaction(async (tx) => {
  // Multiple related operations
});
```

### Decimal Handling for Monetary Values
All prices and monetary values use Prisma.Decimal with string constructor:
```typescript
import { Prisma } from '@prisma/client';
basePrice: new Prisma.Decimal('9.99')
```

### Soft Delete Pattern
Never hard delete records. Always set `deletedAt` timestamp:
```typescript
update({ where: { id }, data: { deletedAt: new Date() } })
```

### Role-Based Store Access
Check permissions before store operations using the auth service:
```typescript
await this.authService.checkStorePermission(userId, storeId, [Role.OWNER, Role.ADMIN]);
```

### Nested Data Synchronization
When syncing nested data (like customization groups), delete removed items first, then upsert:
```typescript
// 1. Delete removed items
await tx.customizationGroup.deleteMany({ where: { menuItemId, id: { notIn: existingIds } } });
// 2. Upsert remaining items
for (const group of groups) {
  await tx.customizationGroup.upsert(...);
}
```

## Module Architecture

### Core Modules
- **AuthModule**: JWT authentication with refresh tokens, role-based access control
- **StoreModule**: Multi-store management, settings, user role assignment
- **MenuModule**: Categories and menu items with complex customization groups
- **CategoryModule**: Category management with sorting capabilities
- **TableModule**: Physical table management within stores
- **ActiveTableSessionModule**: Active dining sessions with real-time updates
- **OrderModule**: Order processing from cart to payment
- **CartModule**: Shopping cart functionality for active sessions

### Supporting Modules
- **CommonModule**: Shared utilities, decorators, and infrastructure services
- **EmailModule**: Email notifications and password reset functionality
- **UserModule**: User profile and store membership management

### Infrastructure Services
- **PrismaService**: Database ORM client with transaction support
- **S3Service**: AWS S3 file upload and management
- **UnusedImageCleanupService**: Scheduled job to remove orphaned images

## Database Schema Key Points

### Primary Entities
- **User**: System users with email verification
- **Store**: Restaurant locations with unique slugs
- **UserStore**: Many-to-many relationship with roles (OWNER, ADMIN, CHEF, CASHIER, SERVER)
- **MenuItem**: Products with base price and customization groups
- **Table**: Physical tables in a store
- **ActiveTableSession**: Current dining sessions
- **Order**: Completed orders with VAT and service charge calculations

### Important Relationships
- Store ↔ User: Many-to-many through UserStore with roles
- Store → StoreInformation: One-to-one configuration
- Store → StoreSetting: One-to-one settings (currency, VAT rate)
- Category → MenuItem: One-to-many with soft delete
- MenuItem → CustomizationGroup → CustomizationOption: Nested customizations
- Table → ActiveTableSession: One-to-one active session
- ActiveTableSession → Cart/ActiveOrder: Session-based ordering

## API Structure

### Authentication Flow
1. Login: `POST /auth/login` → Returns access & refresh tokens
2. Refresh: `POST /auth/refresh` → New access token
3. Customer Session: `POST /auth/customer-session` → Table-based authentication

### Resource Endpoints
- `/stores`: Store management and settings
- `/menu`: Public menu listing and item management
- `/categories`: Category CRUD with sorting
- `/tables`: Table management and batch operations
- `/active-table-sessions`: Session creation and management
- `/cart`: Cart operations for active sessions
- `/orders`: Order creation and payment processing

## Error Handling

The system uses a StandardErrorHandler decorator for consistent error responses:
```typescript
@StandardErrorHandler()
async someMethod() {
  // Method implementation
}
```

This automatically catches and formats errors with proper HTTP status codes and standardized response structure.

## Environment Configuration

Required environment variables (see .env.example):
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET` & `JWT_REFRESH_SECRET`: Token secrets
- `AWS_*`: S3 configuration for file uploads (optional)
- `SMTP_*`: Email service configuration (optional)

## Testing Strategy

1. **Unit Tests**: Service layer business logic
2. **Integration Tests**: Controller endpoints with mocked services
3. **E2E Tests**: Full API flow testing with test database

## Important Implementation Notes

1. **UUID v7**: All entities use UUID v7 for IDs, validated with `ParseUUIDPipe`
2. **Slug Generation**: Store slugs use format: `slugify(name) + '-' + nanoid(6)`
3. **Sort Orders**: Categories and MenuItems maintain `sortOrder` field
4. **Status Enums**: PreparationStatus, CustomerRequestType, Currency are Prisma enums
5. **Validation**: DTOs use class-validator with whitelist enabled
6. **CORS**: Configured per environment (localhost for dev, custom origin for production)
7. **Rate Limiting**: 60 requests per minute using @nestjs/throttler
8. **Swagger**: API documentation available at `/api-docs` with JWT authentication

## Common Development Workflows

### Adding a New Feature Module
1. Generate module: `nest g module feature-name`
2. Generate service: `nest g service feature-name`
3. Generate controller: `nest g controller feature-name`
4. Add to AppModule imports
5. Create DTOs with validation
6. Add Prisma model if needed, run migrations

### Modifying Database Schema
1. Update `prisma/schema.prisma`
2. Run `npm run migrate:db` to create migration
3. Run `npm run generate:db` to update client
4. Update seed file if needed

### Implementing Store-Scoped Endpoint
1. Add `@Param('storeId', ParseUUIDPipe) storeId` to controller
2. Check permissions in service using `checkStorePermission`
3. Include `storeId` in all Prisma queries
4. Add appropriate guards (`@UseGuards(JwtAuthGuard)`)

## Security Considerations

- All monetary operations use transactions
- Store isolation enforced at service layer
- Role-based access control for all mutations
- Soft deletes preserve audit trail
- JWT tokens with refresh mechanism
- Input validation and sanitization via DTOs
- Rate limiting on all endpoints

## Development Guardrails

### Environment & Config
- Use `@nestjs/config` with zod or joi validation for environment variables
- Separate `.env`, `.env.dev`, `.env.prod` and never commit them
- Validate all environment variables on application startup
- Use ConfigService for accessing configuration values, never process.env directly

### Modules
- Each domain module exports only necessary providers
- Use `forFeature()` pattern in PrismaModule for scoped repositories
- Keep modules focused on single domain responsibility
- Export services through module exports, not individual files

### Repositories
- Encapsulate all Prisma calls in repository classes (no raw Prisma calls in controllers)
- Use transactions via `prisma.$transaction` when handling multiple writes
- Repository pattern example:
```typescript
// user.repository.ts
export class UserRepository {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
```

### DTOs & Validation
- Decorate all DTOs with `class-validator` and `class-transformer`
- Keep DTOs in domain-specific folders (e.g., `src/user/dto/`)
- Use transformation for type coercion
- Example DTO structure:
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

### Controllers
- Always return typed responses (e.g., `Promise<UserDto>`)
- Handle exceptions via global filters (`HttpExceptionFilter`)
- Keep controllers thin - business logic belongs in services
- Use proper HTTP status codes and response DTOs

### Error Handling
- Map Prisma errors to domain exceptions:
  - Unique constraint → `ConflictException`
  - Record not found → `NotFoundException`
  - Foreign key constraint → `BadRequestException`
- Never leak internal errors or stack traces to API consumers
- Use custom exception classes for domain-specific errors
```typescript
if (error.code === 'P2002') {
  throw new ConflictException('Email already exists');
}
```

### Logging
- Use Nest's `LoggerService` or wrap pino/winston
- Log structured data, not just strings:
```typescript
this.logger.log({
  action: 'user_created',
  userId: user.id,
  email: user.email,
  timestamp: new Date()
});
```
- Include correlation IDs for request tracing
- Log at appropriate levels (error, warn, log, debug)

### Testing
- Use `@nestjs/testing` utilities with SQLite in-memory DB for unit tests
- Mock Prisma for service-level tests using jest mocks
- Test structure:
```typescript
beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      UserService,
      { provide: PrismaService, useValue: mockPrisma }
    ]
  }).compile();
});
```
- Maintain test coverage above 80% for critical business logic

### Security Best Practices
- Sanitize all inputs using class-validator decorators
- Validate JWTs via guards (`@UseGuards(JwtAuthGuard)`)
- Use parameterized Prisma queries—avoid string interpolation
- Never construct SQL queries with string concatenation
- Implement proper RBAC (Role-Based Access Control) checks
- Use bcrypt for password hashing with appropriate salt rounds

### Performance
- Use Prisma `select`/`include` carefully to prevent overfetching:
```typescript
prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true
    // Only select needed fields
  }
});
```
- Consider caching (Redis, in-memory) for read-heavy endpoints
- Use database indexes for frequently queried fields
- Implement pagination for list endpoints
- Use connection pooling for database connections
- Monitor and optimize N+1 query problems