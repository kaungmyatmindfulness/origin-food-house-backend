# Origin Food House Backend - AI Coding Assistant Instructions

## Architecture Overview

Multi-tenant restaurant management system built with NestJS, using Prisma ORM with PostgreSQL. Each restaurant (Store) can have multiple locations, menus, and customization options.

## Domain Model Hierarchy

```
User → UserStore (many-to-many with roles) → Store
Store → StoreInformation (1:1) + StoreSetting (1:1)
Store → Category → MenuItem → CustomizationGroup → CustomizationOption
Store → Table → ActiveTableSession → Cart/ActiveOrder → Order
```

## Critical Patterns to Follow

### 1. Multi-Store Architecture Pattern

Every entity is scoped to a store. Always include `storeId` in queries:

```typescript
// See: src/menu/menu.service.ts
where: { storeId, deletedAt: null }
```

### 2. Transaction Safety with Nested Operations

Always use transactions for multi-step operations, especially with nested creates/updates:

```typescript
// See: src/store/store.service.ts:createStore
await this.prisma.$transaction(async (tx) => {
  const store = await tx.store.create({
    data: {
      slug: generateUniqueSlug(),
      information: { create: { name: dto.name } },
      setting: { create: {} },
    },
  });
  await tx.userStore.create({
    data: { userId, storeId: store.id, role: Role.OWNER },
  });
  return store;
});
```

### 3. Decimal Handling for Prices

All monetary values use Prisma.Decimal:

```typescript
// See: prisma/seed.ts
import { Prisma } from '@prisma/client';
basePrice: new Prisma.Decimal('9.99'), // Always use string constructor
vatRate: new Prisma.Decimal('0.07')
```

### 4. Soft Delete Pattern

Never hard delete. Always set `deletedAt`:

```typescript
// See: src/category/category.service.ts
update({ where: { id }, data: { deletedAt: new Date() } });
```

### 5. Role-Based Store Access

Check store permissions before operations:

```typescript
// See: src/store/store.service.ts:updateStoreInformation
await this.authService.checkStorePermission(userId, storeId, [
  Role.OWNER,
  Role.ADMIN,
]);
```

### 6. Nested Data Synchronization

When syncing nested data (like customization groups), delete removed items first:

```typescript
// See: src/menu/menu.service.ts:syncCustomizationGroups
// 1. Delete removed groups
await tx.customizationGroup.deleteMany({ where: { menuItemId, id: { notIn: existingIds } } });
// 2. Then upsert remaining
for (const group of groups) { await tx.customizationGroup.upsert(...); }
```

## Service Boundaries

- **AuthModule**: JWT auth with refresh tokens, store permission checking
- **StoreModule**: Store creation, settings, user role management
- **MenuModule**: Categories, menu items with complex customization groups
- **TableModule**: Table management, active sessions
- **OrderModule**: Cart, active orders, order processing
- **MediaModule**: S3 image uploads with orphan cleanup

## Development Workflow

```bash
npm install
npm run db:migrate:dev   # Run migrations
npm run db:seed          # Seed with demo data (owner@test.com/test1234)
npm run dev              # Start with hot reload
npm run db:studio        # Prisma Studio GUI
```

## Store-Specific Patterns

1. **UUID v7 for IDs**: All entities use UUIDs, validated with `ParseUUIDPipe({ version: '7' })`
2. **Slug Generation**: Store slugs use nanoid suffix: `slugify(name) + '-' + nanoid(6)`
3. **Sort Orders**: Categories and MenuItems maintain `sortOrder` for display
4. **Status Enums**: PreparationStatus, Currency, Role are Prisma enums

## Common Pitfalls

- Don't forget `storeId` in queries - data isolation is critical
- Don't create store entities without proper transaction wrapping
- Don't use `number` for prices - always `string`/`Prisma.Decimal`
- Don't skip role checking - use `checkStorePermission` before mutations
