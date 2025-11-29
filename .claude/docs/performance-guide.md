# Performance Considerations

## Database Queries

```typescript
// EFFICIENT - Select only needed fields
const users = await this.prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
  },
});

// INEFFICIENT - Fetches all fields including large text
const users = await this.prisma.user.findMany();

// EFFICIENT - Use cursor-based pagination for large datasets
const items = await this.prisma.menuItem.findMany({
  take: 20,
  skip: 1,
  cursor: { id: lastItemId },
});

// INEFFICIENT - Offset pagination on large tables
const items = await this.prisma.menuItem.findMany({
  skip: 10000,
  take: 20,
});
```

## Caching Strategy

**ALWAYS use Redis for caching (not in-memory or database caching):**

```typescript
// CORRECT - Redis caching for frequently accessed, rarely changed data
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

## Cache Invalidation Pattern

```typescript
// CORRECT - Invalidate cache after mutations
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

// CORRECT - Cache with pattern-based invalidation
async invalidateStoreCache(storeId: string): Promise<void> {
  const pattern = `store:${storeId}:*`;
  await this.cacheService.deletePattern(pattern);
}
```

## Caching Rules

- ALWAYS use Redis (never in-memory caching in services)
- CACHE read-heavy, write-light data (store details, menu items)
- SET appropriate TTL (Time To Live):
  - 5-15 minutes for frequently changing data
  - 1-24 hours for static data
- INVALIDATE cache on every mutation
- USE pattern-based cache keys: `entity:id:subresource`
- NEVER cache user-specific sensitive data without proper isolation

## Query Optimization

### Avoid N+1 Queries

```typescript
// BAD - N+1 query problem
const orders = await this.prisma.order.findMany();
for (const order of orders) {
  const items = await this.prisma.orderItem.findMany({
    where: { orderId: order.id },
  });
}

// GOOD - Single query with include
const orders = await this.prisma.order.findMany({
  include: {
    items: true,
  },
});
```

### Select Only Required Fields

```typescript
// GOOD - Select specific fields for list operations
const menuItems = await this.prisma.menuItem.findMany({
  where: { storeId, deletedAt: null },
  select: {
    id: true,
    name: true,
    price: true,
    isActive: true,
  },
});

// BAD - Fetches all fields including descriptions, images
const menuItems = await this.prisma.menuItem.findMany({
  where: { storeId, deletedAt: null },
});
```

### Use Proper Pagination

```typescript
// GOOD for small datasets - Offset pagination
const items = await this.prisma.menuItem.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});

// GOOD for large datasets - Cursor-based pagination
const items = await this.prisma.menuItem.findMany({
  take: limit,
  cursor: lastItemId ? { id: lastItemId } : undefined,
  skip: lastItemId ? 1 : 0,
  orderBy: { id: 'asc' },
});
```

## Performance Checklist

Before marking any database-heavy feature complete:

- [ ] SELECT only needed fields (not `SELECT *`)
- [ ] Pagination implemented for large datasets
- [ ] Redis caching for read-heavy operations
- [ ] Connection pool configured appropriately
- [ ] N+1 query problem avoided (use `include` or `select`)
- [ ] Indexes created for frequently queried fields
- [ ] Cache invalidation implemented for mutations
- [ ] Cursor-based pagination for very large tables
