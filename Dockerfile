# =============================================================================
# Production Dockerfile - NOT for local development
# =============================================================================
# This Dockerfile is for PRODUCTION DEPLOYMENT only.
# For local development, run the app natively and use docker-compose.yml
# to start only the required services (PostgreSQL, etc.)
#
# To build: docker build -t origin-food-house-backend .
# To run: See docker-compose.yml for production deployment
# =============================================================================

# Multi-stage build for production optimization
FROM node:lts-alpine AS base

# Install necessary dependencies for Prisma and native modules
RUN apk add --no-cache libc6-compat openssl

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies with optimizations
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Generate Prisma client in deps stage
RUN npx prisma generate

# Build stage - compile TypeScript
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build && \
    npm prune --production

# Production image, copy all the files and run nest
FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy necessary files from previous stages
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# Copy startup script
COPY --chown=nestjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

USER nestjs

EXPOSE 3000

ENV PORT=3000 \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use startup script that handles migrations
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
