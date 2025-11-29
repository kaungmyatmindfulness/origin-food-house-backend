# Architecture Patterns

## Multi-Tenancy

**Store Isolation**: All data operations MUST be scoped to a specific store.

```typescript
// CORRECT - Store-scoped query
async getMenuItems(storeId: string) {
  return this.prisma.menuItem.findMany({
    where: {
      storeId,
      deletedAt: null,
    },
  });
}

// INCORRECT - Cross-store data leak
async getMenuItems() {
  return this.prisma.menuItem.findMany(); // Returns items from ALL stores
}
```

**Rules:**
- ALWAYS filter by `storeId` in queries
- ALWAYS verify user has access to the store before operations
- ALWAYS include store context in audit logs

## Soft Deletes

**NEVER hard delete records** - use soft deletes for audit trails:

```typescript
// CORRECT - Soft delete
async deleteMenuItem(id: string) {
  return this.prisma.menuItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// INCORRECT - Hard delete (loses audit trail)
async deleteMenuItem(id: string) {
  return this.prisma.menuItem.delete({ where: { id } });
}
```

**Rules:**
- ALWAYS use `deletedAt` timestamp for deletions
- ALWAYS exclude soft-deleted records with `where: { deletedAt: null }`
- NEVER use `prisma.model.delete()` except for test cleanup

## Real-Time Features (WebSocket)

**CRITICAL SECURITY**: WebSocket gateways MUST authenticate connections.

```typescript
// CRITICAL VULNERABILITY - No authentication (existing code has this issue)
@WebSocketGateway()
export class CartGateway {
  @SubscribeMessage("cart:add")
  async handleAddItem(client: Socket, data: any) {
    // Anyone can manipulate any cart!
  }
}

// CORRECT - Authenticated WebSocket (MUST implement)
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

## Role-Based Access Control (RBAC)

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

// Usage in service
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

## Image Storage & Multi-Size System

**CRITICAL**: This project uses **path-based image storage**, NOT full URLs in the database.

### Architecture Overview

**Backend stores**: Base S3 paths (e.g., `"uploads/abc-123-def"`)
**Frontend constructs**: Full URLs with size suffix (e.g., `baseUrl + path + "-medium.webp"`)
**Benefits**: Zero backend bandwidth, easy CDN integration, flexible infrastructure

### Database Fields

```typescript
// CORRECT - Store base paths
model MenuItem {
  imagePath String?  // "uploads/abc-123-def" (no version suffix, no URL)
}

model StoreInformation {
  logoPath       String?  // "uploads/logo-456"
  coverPhotoPath String?  // "uploads/cover-789"
}

// INCORRECT - Don't store full URLs
model MenuItem {
  imageUrl String?  // "https://bucket.s3.amazonaws.com/uploads/abc-medium.webp" - NO!
}
```

### Upload Service Returns Paths

```typescript
// CORRECT - UploadService returns base path
const uploadResult = await this.uploadService.uploadImage(file, "menu-item");
// Returns: { basePath: "uploads/abc-123", availableSizes: ["small", "medium", "large"] }

await this.prisma.menuItem.create({
  data: {
    imagePath: uploadResult.basePath, // Store base path only
  },
});

// INCORRECT - Don't construct or store URLs
await this.prisma.menuItem.create({
  data: {
    imagePath: `https://bucket.s3.amazonaws.com/${uploadResult.basePath}-medium.webp`, // NO!
  },
});
```

### Available Image Sizes

**Image Size Presets** (defined in `src/common/upload/types/image-size-config.type.ts`):

| Preset          | Sizes Generated                               | Primary  | File Pattern                                   |
| --------------- | --------------------------------------------- | -------- | ---------------------------------------------- |
| `menu-item`     | small (400px), medium (800px), large (1200px) | medium   | `uploads/uuid-{size}.webp`                     |
| `store-logo`    | small (200px), medium (400px)                 | medium   | `uploads/uuid-{size}.webp`                     |
| `cover-photo`   | small (400px), medium (800px), large (1200px) | large    | `uploads/uuid-{size}.webp`                     |
| `payment-proof` | original (no resize)                          | original | `payment-proofs/{storeId}/uuid-original.{ext}` |

### Upload Flow

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
    imagePath: uploadResult.basePath, // Just the base path
  },
});

// 3. API returns base path to frontend
return {
  id: "item-123",
  name: "Pad Thai",
  imagePath: "uploads/abc-123-def", // Frontend constructs URLs
};
```

### Input Validation

**ALWAYS use `@IsImagePath()` validator for image fields:**

```typescript
// CORRECT - Validate base path format
import { IsImagePath } from "src/common/validators/is-image-path.validator";

export class CreateMenuItemDto {
  @IsOptional()
  @IsString()
  @IsImagePath()
  imagePath?: string; // Validates: "uploads/abc-123" or "payment-proofs/store/uuid"
}

// INCORRECT - Don't use URL validator for paths
import { IsS3ImageUrl } from "src/common/validators/is-s3-image-url.validator";

export class CreateMenuItemDto {
  @IsS3ImageUrl() // NO! This expects full HTTPS URLs
  imagePath?: string;
}
```

### Path Utilities

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

### Image Upload Rules

- ALWAYS return `basePath` from upload service (not full URLs)
- ALWAYS store base paths in database (e.g., `"uploads/uuid"`)
- NEVER store version suffixes in database (no `-small`, `-medium`, `-large`)
- NEVER store full URLs in database
- ALWAYS use `@IsImagePath()` validator for input DTOs
- ALWAYS document in API responses that paths require frontend URL construction

### Cleanup Service Pattern

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

## Data Mapping: Database to Domain to API

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

**When to use each layer:**
- **Prisma Models**: ALWAYS (database operations)
- **Domain Entities**: ONLY when you have complex business rules that belong to the entity
- **DTOs**: ALWAYS for API input/output

**This project's pattern:**
- Often returns Prisma entities directly (acceptable for simple cases)
- Uses DTOs for input validation
- Consider adding domain entities for complex business logic (order calculations, payment processing)
