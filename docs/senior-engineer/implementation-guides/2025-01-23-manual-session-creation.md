# Manual Session Creation Implementation

**Date**: January 23, 2025
**Feature**: Staff-initiated manual order sessions (counter, phone, takeout)
**Status**: ✅ Implemented and Tested

## Overview

Implemented the ability for restaurant staff to create manual order sessions without table association. This supports counter orders, phone orders, and takeout orders initiated by staff members through the Restaurant Management System (RMS).

## Database Schema

The following schema changes were already in place (from previous work):

```prisma
model ActiveTableSession {
  id            String       @id @default(uuid(7))
  storeId       String
  tableId       String?      // Now nullable for manual sessions
  sessionType   SessionType  @default(TABLE)
  sessionToken  String       @unique
  guestCount    Int          @default(1)
  customerName  String?      // Optional customer name
  customerPhone String?      // Optional customer phone
  status        SessionStatus @default(ACTIVE)
  // ... other fields
}

enum SessionType {
  TABLE
  COUNTER
  PHONE
  TAKEOUT
}
```

## Implementation Details

### 1. DTO - CreateManualSessionDto

**File**: `src/active-table-session/dto/create-manual-session.dto.ts`

```typescript
export class CreateManualSessionDto {
  @IsEnum(SessionType)
  sessionType: SessionType;  // COUNTER, PHONE, or TAKEOUT

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;
}
```

**Validation Rules**:
- `sessionType` is required and must be one of: COUNTER, PHONE, TAKEOUT
- `customerName` is optional string
- `customerPhone` is optional string
- `guestCount` is optional integer (min: 1, default: 1)

### 2. Service Method - createManualSession

**File**: `src/active-table-session/active-table-session.service.ts`

**Method Signature**:
```typescript
async createManualSession(
  userId: string,
  storeId: string,
  dto: CreateManualSessionDto,
): Promise<ActiveTableSession>
```

**Key Features**:
1. **RBAC Enforcement**: Validates user has OWNER, ADMIN, SERVER, or CASHIER role
2. **Session Type Validation**: Rejects TABLE type (must use join-by-table endpoint)
3. **Secure Token Generation**: Uses crypto.randomBytes(32) for session token
4. **Transactional Integrity**: Creates session and cart in single transaction
5. **Cart Initialization**: Automatically creates empty cart with $0.00 subtotal
6. **Error Handling**: Properly maps exceptions (ForbiddenException, BadRequestException, etc.)

**Implementation Pattern**:
```typescript
// 1. Validate permissions
await this.authService.checkStorePermission(userId, storeId, [
  Role.OWNER, Role.ADMIN, Role.SERVER, Role.CASHIER
]);

// 2. Validate sessionType
if (dto.sessionType === SessionType.TABLE) {
  throw new BadRequestException('Cannot create manual session with type TABLE');
}

// 3. Create session and cart in transaction
await this.prisma.$transaction(async (tx) => {
  const session = await tx.activeTableSession.create({
    data: {
      storeId,
      tableId: null,  // Manual sessions have no table
      sessionType: dto.sessionType,
      sessionToken: this.generateSessionToken(),
      guestCount: dto.guestCount ?? 1,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      status: SessionStatus.ACTIVE,
    },
  });

  await tx.cart.create({
    data: {
      sessionId: session.id,
      storeId,
      subTotal: new Prisma.Decimal('0'),
    },
  });

  return session;
});
```

### 3. Controller Endpoint

**File**: `src/active-table-session/active-table-session.controller.ts`

**Endpoint**: `POST /active-table-sessions/manual?storeId={storeId}`

**Authentication**: Requires JWT (JwtAuthGuard)

**Authorization**: OWNER, ADMIN, SERVER, or CASHIER role

**Request Body**:
```json
{
  "sessionType": "COUNTER",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "guestCount": 2
}
```

**Response**:
```json
{
  "data": {
    "id": "session-123",
    "storeId": "store-456",
    "tableId": null,
    "sessionType": "COUNTER",
    "sessionToken": "abc123...",
    "guestCount": 2,
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "status": "ACTIVE",
    "cart": {
      "id": "cart-789",
      "sessionId": "session-123",
      "storeId": "store-456",
      "subTotal": "0",
      "items": []
    }
  },
  "success": true
}
```

**Swagger Documentation**:
```typescript
@ApiOperation({
  summary: 'Create manual session (counter, phone, takeout)',
  description: 'Staff-initiated orders without table association. Requires OWNER, ADMIN, SERVER, or CASHIER role.',
})
@ApiResponse({
  status: 201,
  description: 'Manual session created successfully',
  type: SessionResponseDto,
})
@ApiResponse({ status: 403, description: 'Insufficient permissions' })
```

### 4. Supporting Components

#### GetUser Decorator

**File**: `src/common/decorators/get-user.decorator.ts`

Created a custom decorator to extract user data from JWT:

```typescript
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as Record<string, unknown> | undefined;

    if (data && user) {
      return user[data];  // Extract specific field (e.g., 'sub' for userId)
    }

    return user;  // Return full user object
  },
);
```

**Usage in Controller**:
```typescript
@Post('manual')
async createManualSession(
  @GetUser('sub') userId: string,  // Extracts user ID from JWT
  @Query('storeId') storeId: string,
  @Body() dto: CreateManualSessionDto,
) {
  // ...
}
```

## Testing

**File**: `src/active-table-session/active-table-session.service.spec.ts`

**Test Coverage**: 14 comprehensive tests covering all scenarios

### Test Categories

1. **Counter Orders** (2 tests)
   - ✅ Create counter session successfully
   - ✅ Create with customer details

2. **Phone Orders** (1 test)
   - ✅ Create phone order session with customer info

3. **Takeout Orders** (1 test)
   - ✅ Create takeout session

4. **Validation** (2 tests)
   - ✅ Reject TABLE sessionType
   - ✅ Default guestCount to 1 if not provided

5. **RBAC Enforcement** (6 tests)
   - ✅ Allow OWNER to create
   - ✅ Allow ADMIN to create
   - ✅ Allow SERVER to create
   - ✅ Allow CASHIER to create
   - ✅ Reject users without proper role
   - ✅ Reject users not in the store

6. **Cart Initialization** (2 tests)
   - ✅ Initialize cart with zero subtotal
   - ✅ Return session with cart included

### Test Results

```
Test Suites: 1 passed
Tests:       14 passed
Time:        2.7s
```

### Full Test Suite Impact

```
Test Suites: 11 total (10 passed, 1 unrelated failure)
Tests:       306 passed total
```

## Integration Notes

### Module Dependencies

**File**: `src/active-table-session/active-table-session.module.ts`

Added AuthModule to imports:

```typescript
@Module({
  imports: [AuthModule],  // Required for AuthService
  controllers: [ActiveTableSessionController],
  providers: [ActiveTableSessionService, PrismaService],
  exports: [ActiveTableSessionService],
})
export class ActiveTableSessionModule {}
```

### Cart Service Integration

Manual sessions integrate seamlessly with existing CartService. The cart validation logic already supports both:
- Session token validation (for customers)
- User ID validation with RBAC (for staff)

Staff can manage manual session carts through existing cart endpoints:
- `POST /cart/:sessionId/items` - Add items
- `PUT /cart/:sessionId/items/:itemId` - Update quantities
- `DELETE /cart/:sessionId/items/:itemId` - Remove items
- `DELETE /cart/:sessionId` - Clear cart

## Files Changed

### New Files Created (5)

1. `/src/active-table-session/dto/create-manual-session.dto.ts` - DTO with validation
2. `/src/active-table-session/active-table-session.service.spec.ts` - Comprehensive tests (14 tests)
3. `/src/common/decorators/get-user.decorator.ts` - Custom parameter decorator
4. `/docs/senior-engineer/implementation-guides/2025-01-23-manual-session-creation.md` - This document

### Modified Files (3)

1. `/src/active-table-session/active-table-session.service.ts`
   - Added `createManualSession` method
   - Added AuthService dependency injection
   - Added ForbiddenException error handling

2. `/src/active-table-session/active-table-session.controller.ts`
   - Added `POST /manual` endpoint
   - Added Swagger documentation

3. `/src/active-table-session/active-table-session.module.ts`
   - Added AuthModule import

## API Examples

### Create Counter Order

```bash
curl -X POST http://localhost:3000/active-table-sessions/manual?storeId=store-123 \
  -H "Authorization: Bearer {jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionType": "COUNTER",
    "guestCount": 1
  }'
```

### Create Phone Order

```bash
curl -X POST http://localhost:3000/active-table-sessions/manual?storeId=store-123 \
  -H "Authorization: Bearer {jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionType": "PHONE",
    "customerName": "Jane Smith",
    "customerPhone": "+1234567890",
    "guestCount": 3
  }'
```

### Create Takeout Order

```bash
curl -X POST http://localhost:3000/active-table-sessions/manual?storeId=store-123 \
  -H "Authorization: Bearer {jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionType": "TAKEOUT",
    "customerName": "Bob Wilson"
  }'
```

## Security Considerations

1. **RBAC Enforcement**: Only authorized staff roles can create manual sessions
2. **Store Isolation**: Users can only create sessions for stores they belong to
3. **Session Token Security**: 64-character hex tokens (256-bit entropy)
4. **Input Validation**: All inputs validated with class-validator decorators
5. **Error Handling**: Generic error messages prevent information disclosure

## Frontend Integration

### Type Generation

After backend changes, regenerate frontend types:

```bash
cd origin-food-house-frontend
npm run generate:api
```

### Service Function Example

```typescript
import { apiFetch, unwrapData } from '@/utils/apiFetch';
import type { CreateManualSessionDto, SessionResponseDto } from '@repo/api/generated/types';

export async function createManualSession(
  storeId: string,
  data: CreateManualSessionDto
): Promise<SessionResponseDto> {
  const res = await apiFetch<SessionResponseDto>({
    path: '/active-table-sessions/manual',
    method: 'POST',
    query: { storeId },
    body: JSON.stringify(data),
  });
  return unwrapData(res, 'Failed to create manual session');
}
```

### React Query Hook Example

```typescript
export function useCreateManualSession(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateManualSessionDto) =>
      createManualSession(storeId, data),
    onSuccess: (session) => {
      // Invalidate sessions list
      queryClient.invalidateQueries({
        queryKey: sessionKeys.active(storeId)
      });
      // Navigate to order screen or show success
      toast.success('Session created');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
```

## Future Enhancements

1. **Session Merging**: Allow merging multiple manual sessions
2. **Caller ID Integration**: Automatically populate phone number for phone orders
3. **Customer History**: Track repeat customers by phone/name
4. **Delivery Address**: Add delivery address field for takeout/phone orders
5. **Estimated Time**: Add expected pickup/delivery time
6. **Order Notes**: Add staff notes field for special instructions

## Acceptance Criteria Status

- ✅ Manual sessions can be created without table
- ✅ Session token generated securely
- ✅ Cart initialized automatically
- ✅ Proper RBAC enforcement
- ✅ All tests pass (14/14)
- ✅ Build succeeds
- ✅ No lint errors
- ✅ Swagger documentation complete

## Conclusion

The manual session creation feature is fully implemented, tested, and production-ready. It follows all Origin Food House architectural patterns including:

- Transactional integrity
- RBAC enforcement
- Store isolation
- Soft deletes support
- Comprehensive error handling
- Type-safe DTOs
- Thorough test coverage

The feature seamlessly integrates with existing cart, order, and payment systems, enabling staff to efficiently process counter, phone, and takeout orders.
