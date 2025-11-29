# Prisma 7 Migration & Configuration

This project uses **Prisma 7.0.0**, which introduced significant architectural changes. The migration was completed successfully with the following configuration.

## Key Prisma 7 Features Used

### 1. New Configuration File (`prisma.config.ts`)

Prisma 7 introduces a TypeScript-based configuration file that replaces the previous approach:

```typescript
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node --transpile-only prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

### 2. Driver Architecture with `@prisma/adapter-pg`

Prisma 7 uses a new driver-based architecture with adapters. This project uses the PostgreSQL adapter:

```typescript
// src/prisma/prisma.service.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "src/generated/prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>("DATABASE_URL");
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Benefits of the adapter pattern:**
- Direct connection pooling via `pg` library
- Better performance and control over database connections
- Flexibility to swap database drivers without changing application code

### 3. Custom Client Output Path

The Prisma client is generated to a custom location for better project organization:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma/client"
}
```

Import pattern:

```typescript
import { PrismaClient } from "src/generated/prisma/client";
```

## TypeScript Configuration for Prisma 7

**Important**: Despite Prisma 7 documentation mentioning "esnext", the project successfully uses **CommonJS** output:

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
    // ... other options
  }
}
```

**Why CommonJS works with Prisma 7:**
- Prisma 7's "esnext" requirement refers to TypeScript's ability to understand modern import syntax during compilation
- The final compiled JavaScript output can be CommonJS
- ES modules in Node.js would require adding `.js` extensions to all imports (not practical for large codebases)
- NestJS standard configuration (CommonJS) is fully compatible with Prisma 7

## Prisma 7 Best Practices

**DO:**
- Use the `@prisma/adapter-pg` driver for PostgreSQL
- Configure connection pooling via the `pg` library's `Pool`
- Use `prisma.config.ts` for centralized configuration
- Keep TypeScript configuration as `module: "commonjs"` for NestJS projects
- Extend `PrismaClient` in your service class for proper lifecycle management

**DON'T:**
- Don't switch to ES modules unless absolutely necessary (requires extensive refactoring)
- Don't use the old `PrismaClient` constructor without adapters (deprecated in Prisma 7)
- Don't skip the `onModuleInit` and `onModuleDestroy` lifecycle hooks
- Don't access Prisma client before it's connected (`$connect()` in `onModuleInit`)

## Package Versions

Current Prisma 7 setup:

```json
{
  "@prisma/adapter-pg": "^7.0.0",
  "@prisma/client": "^7.0.0",
  "prisma": "^7.0.0",
  "pg": "^8.13.1"
}
```
