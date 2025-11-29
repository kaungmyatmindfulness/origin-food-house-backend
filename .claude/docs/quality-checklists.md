# Quality Checklists

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
- [ ] REST API conventions followed (nouns, HTTP methods, proper status codes)
- [ ] No `Record<string, unknown>` in OpenAPI DTOs (use typed `additionalProperties`)

**If ANY item fails, the task is NOT complete.**

---

## Comprehensive Quality Checklist

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

### REST API Conventions

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

### OpenAPI Type Safety

- [ ] No `additionalProperties: true` without typed schema in DTOs
- [ ] Object fields use `properties` or `additionalProperties: { $ref: "..." }`
- [ ] Value DTOs for Record types registered in `extraModels` (main.ts)
- [ ] Frontend type generation produces no `Record<string, unknown>`

**If ANY item fails, the task is NOT complete.**
