# Code Style & Formatting

## Prettier Configuration

**Implicit configuration** (using Prettier defaults):
- Single quotes for strings
- 2 spaces indentation
- Semicolons required
- Trailing commas in multi-line

## ESLint Rules (Key Enforcements)

```typescript
// 1. Nullish coalescing over OR
const value = config ?? "default"; // GOOD
const value = config || "default"; // BAD

// 2. Optional chaining
const name = user?.profile?.name; // GOOD
const name = user && user.profile && user.profile.name; // BAD

// 3. No floating promises
await this.service.doSomething(); // GOOD
this.service.doSomething(); // BAD - ESLint error

// 4. Prefer const
const items = []; // GOOD
let items = []; // BAD (if never reassigned)

// 5. Template literals
const message = `User ${userId} created`; // GOOD
const message = "User " + userId + " created"; // BAD

// 6. Import order (enforced by eslint-plugin-import)
// 1. Built-in modules (fs, path)
// 2. External modules (@nestjs/common)
// 3. Internal modules (src/...)
// 4. Parent/sibling imports (../, ./)
// With blank lines between groups, alphabetically sorted
```

## Naming Conventions

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

## File Naming Conventions

```
CORRECT naming patterns:
store.service.ts           # Service
store.controller.ts        # Controller
store.module.ts            # Module
store.service.spec.ts      # Unit test
create-store.dto.ts        # DTO (kebab-case)
store-response.dto.ts      # Response DTO
jwt-auth.guard.ts          # Guard
roles.decorator.ts         # Decorator
prisma-mock.helper.ts      # Test helper

INCORRECT patterns:
StoreService.ts            # Don't use PascalCase for files
store_service.ts           # Don't use snake_case
storeService.ts            # Don't use camelCase
```

## DTO Class Naming (Avoiding Duplicates)

**CRITICAL**: DTO class names MUST be globally unique across the entire codebase. Swagger/OpenAPI uses class names to generate schema definitions, and duplicate names cause schema conflicts.

```typescript
// BAD - Same class name in different modules causes OpenAPI conflicts
// src/category/dto/category-response.dto.ts
export class CategoryResponseDto {
  /* with menuItems */
}

// src/menu/dto/category-response.dto.ts
export class CategoryResponseDto {
  /* without menuItems */
}
// Result: Swagger picks wrong schema, OpenAPI spec is inconsistent

// GOOD - Unique class names per module context
// src/category/dto/category-response.dto.ts
export class CategoryResponseDto {
  /* full category with menuItems */
}

// src/menu/dto/category-response.dto.ts
export class MenuCategoryDto {
  /* simplified category for menu context */
}
```

**DTO naming rules:**
- ALWAYS use globally unique class names
- PREFIX with module/domain name when DTOs serve different purposes:
  - `MenuCategoryDto` (in menu module) vs `CategoryResponseDto` (in category module)
  - `AdminSuspendUserDto` (in admin module) vs `SuspendUserDto` (in user module)
  - `MenuCustomizationGroupDto` vs `CustomizationGroupResponseDto`
- CHECK for existing DTOs before creating new ones: `grep -r "class YourDtoName" src/`
- REUSE existing DTOs when the schema is identical (import from the canonical module)

**Common duplicate patterns to avoid:**

| Instead of...                    | Use...                       | Location         |
| -------------------------------- | ---------------------------- | ---------------- |
| `CategoryResponseDto` (menu)     | `MenuCategoryDto`            | `src/menu/dto/`  |
| `CustomizationGroupResponseDto`  | `MenuCustomizationGroupDto`  | `src/menu/dto/`  |
| `CustomizationOptionResponseDto` | `MenuCustomizationOptionDto` | `src/menu/dto/`  |
| `SuspendUserDto` (admin)         | `AdminSuspendUserDto`        | `src/admin/dto/` |

**If you see this warning, you have duplicate DTOs:**

```
Duplicate DTO detected: "YourDtoName" is defined multiple times with different schemas.
```
