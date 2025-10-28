# Origin Food House - Backend

[![NestJS](https://img.shields.io/badge/NestJS-11.1.6-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.17.1-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Jest](https://img.shields.io/badge/Jest-30.2.0-C21325?logo=jest)](https://jestjs.io/)

Multi-tenant restaurant management platform backend built with NestJS, Prisma ORM, and PostgreSQL.

---

## ⚠️ Project Status

**Current Version:** 0.0.1 (Development)
**Production Ready:** ❌ **NO** - Critical issues present
**Last Updated:** October 28, 2025

### Known Critical Issues

> **See [MASTER_REFACTORING_PLAN.md](docs/MASTER_REFACTORING_PLAN.md) for comprehensive analysis**

- 🔴 **4 Critical Security Vulnerabilities** (CVSS 7.8-9.1)
  - WebSocket authentication bypass
  - Session token exposure
  - Checkout authentication bypass
  - Missing store isolation checks
- 🔴 **Test Execution Crisis** - 11 of 17 test suites fail to compile
- 🟡 **Test Coverage** - 31.7% overall (68.3% untested code)
- 🟡 **Performance Issues** - Kitchen dashboard: 2-5 seconds response time

### Timeline to Production-Ready

**Estimated:** 10-12 weeks with dedicated team

**Phase 1 (Weeks 1-2):** Fix critical security vulnerabilities and test compilation
**Phase 2 (Weeks 3-5):** Improve test coverage to 80%+
**Phase 3 (Weeks 6-8):** Performance optimization and caching
**Phase 4 (Weeks 9-12):** Integration testing and observability

---

## Table of Contents

- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Features](#features)
  - [Authentication & Authorization](#-authentication--authorization)
  - [Store Management](#-store-management)
  - [User Management](#-user-management)
  - [Menu & Category Management](#️-menu--category-management)
  - [Table Management](#-table-management)
  - [Session Management](#-session-management)
  - [Cart & Ordering](#-cart--ordering)
  - [Payment Processing](#-payment-processing)
  - [Kitchen Display System](#-kitchen-display-system-kds)
  - [Reporting & Analytics](#-reporting--analytics)
  - [Subscription Management](#-subscription-management)
  - [Admin Platform](#-admin-platform)
  - [File Storage](#-file-storage)
  - [Real-Time Features](#-real-time-features)
  - [Background Jobs](#-background-jobs)
  - [Email Notifications](#-email-notifications)
  - [Audit Trail](#-audit-trail)
  - [Feature Implementation Status](#feature-implementation-status)
- [Development Setup](#development-setup)
- [Docker Services](#docker-services)
- [Database Management](#database-management)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Security](#security)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## Technology Stack

### Core Framework
- **NestJS** v11.1.6 - Progressive Node.js framework
- **TypeScript** v5.9.3 - Type-safe JavaScript
- **Node.js** 18+ - Runtime environment

### Database & ORM
- **PostgreSQL** 16 - Relational database
- **Prisma** v6.17.1 - Type-safe ORM
- **19 Models** - Multi-tenant schema with soft deletes

### Authentication & Authorization
- **Auth0** - OAuth2/OIDC authentication (exclusive)
- **JWT** - Internal token management
- **Passport** - Authentication middleware
- **RBAC** - Role-based access control (5 roles)

### Real-time & Background Processing
- **Socket.IO** v4.8.1 - WebSocket communication
- **Bull** - Job queue (Redis-based)
- **@nestjs/schedule** - Cron jobs

### File Storage
- **AWS S3** - Cloud file storage
- **Sharp** - Image processing and optimization
- **Multer** - File upload handling

### Testing
- **Jest** v30.2.0 - Testing framework
- **320 Tests** across 17 suites (11 failing due to compilation errors)
- **31.7% Coverage** (target: 80%+)

### Code Quality
- **ESLint** v9.37.0 - Linting
- **Prettier** v3.6.2 - Code formatting
- **Husky** v9.1.7 - Git hooks
- **lint-staged** - Pre-commit checks

### Additional Tools
- **Swagger/OpenAPI** - API documentation
- **Cookie Parser** - Session management
- **Class Validator** - DTO validation
- **Handlebars** - Email templates

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# ⚠️ Edit .env with your Auth0 credentials

# 3. Start database service (PostgreSQL via Docker)
npm run docker:up

# 4. Run database migrations
npm run migrate:db

# 5. Generate Prisma client
npm run generate:db

# 6. Seed database with demo data
npm run seed:db

# 7. Start development server
npm run dev
```

The API will be available at `http://localhost:3000`

**API Documentation:** `http://localhost:3000/api/docs`

---

## Features

Origin Food House provides a comprehensive suite of features for managing multi-tenant restaurant operations.

### 🔐 Authentication & Authorization

**Auth0 Integration** (AuthModule - 1,542 LOC)
- OAuth2/OIDC authentication (exclusive method)
- JWT token generation and validation
- JWKS-based token verification
- User profile sync from Auth0
- Session-based authentication for customer orders
- Role-based access control (RBAC)

**Roles:**
- **Owner** - Full store access, ownership transfer
- **Admin** - Store management, user roles, settings
- **Chef** - Kitchen operations, menu management
- **Cashier** - Payment processing, order management
- **Server** - Order taking, table management

**API Endpoints:**
- `POST /auth/auth0/validate` - Validate Auth0 token
- `POST /auth/login/store` - Select store after login
- `GET /auth/auth0/config` - Get Auth0 configuration
- `GET /auth/auth0/profile` - Get user profile

---

### 🏪 Store Management

**Multi-Tenant Store Operations** (StoreModule - 2,463 LOC)
- Store creation with slug generation
- Store information management (logo, description, contact)
- Store settings (VAT rate, service charge, currency)
- Public store details (no authentication required)
- User role assignment per store
- Invitation-based user onboarding
- Store suspension and banning (Admin)

**Key Capabilities:**
- Transactional store creation (Store + Information + Settings + UserStore)
- Slug uniqueness validation
- Store-scoped data isolation
- Multi-store support per user
- Public QR menu access

**API Endpoints:**
- `POST /store` - Create new store
- `GET /store/:id` - Get store details (public)
- `PATCH /store/:id/information` - Update store info (OWNER/ADMIN)
- `PATCH /store/:id/settings` - Update settings (OWNER/ADMIN)
- `POST /store/:id/users` - Add user to store (OWNER/ADMIN)
- `GET /store/:id/users` - List store users

---

### 👤 User Management

**User Profile & Authentication** (UserModule - 1,620 LOC)
- User profile management
- Auth0 user synchronization
- Profile updates (name, phone)
- Store membership management
- User status tracking (active, suspended, banned)

**Coverage:** 92.06% ✅ (Production-ready)

**API Endpoints:**
- `GET /user/profile` - Get current user profile
- `PATCH /user/profile` - Update profile
- `GET /user/:id` - Get user by ID (admin)
- `POST /user/sync-auth0` - Sync Auth0 user

---

### 🍽️ Menu & Category Management

**Menu Item Management** (MenuModule - 2,223 LOC)
- Menu item CRUD operations
- Pricing and availability control
- Image upload for menu items
- Menu item hiding/showing
- Customization group management
- Customization option variants
- Bulk menu operations
- Public menu access (no auth)

**Customization Features:**
- Multiple customization groups per item
- Single/multiple selection options
- Price adjustments per option
- Required/optional customizations
- Nested customization sync

**Category Management** (CategoryModule - 1,547 LOC)
- Category CRUD with soft deletes
- Drag-and-drop sorting
- Category-menu item relationships
- Cascading category deletion
- Public category access

**Coverage:**
- MenuModule: 73.74% (needs improvement)
- CategoryModule: 95.08% ✅ (Production-ready)

**API Endpoints:**
- `GET /menu/store/:storeId` - Public menu listing
- `POST /menu` - Create menu item (OWNER/ADMIN)
- `PATCH /menu/:id` - Update menu item
- `DELETE /menu/:id` - Soft delete menu item
- `POST /menu/:id/customizations` - Add customization group
- `GET /category/store/:storeId` - Public categories
- `POST /category` - Create category (OWNER/ADMIN)
- `PUT /category/sort` - Reorder categories

---

### 🪑 Table Management

**Table Operations** (TableModule - 1,824 LOC)
- Table CRUD operations
- QR code generation per table
- Batch table creation/updates
- Table capacity management
- Real-time table status
- Table area/zone organization

**Features:**
- UUID-based QR codes for customer access
- Transactional batch operations
- Table status tracking (available, occupied, reserved)
- WebSocket real-time updates

**Coverage:** 86.07% ✅ (Production-ready)

**⚠️ Known Issue:** Soft delete not implemented (hard delete currently)

**API Endpoints:**
- `GET /table/store/:storeId` - List all tables
- `POST /table` - Create table (OWNER/ADMIN)
- `POST /table/batch` - Batch create/update tables
- `GET /table/:id/qr-code` - Generate QR code
- `DELETE /table/:id` - Delete table (⚠️ hard delete)

---

### 🎫 Session Management

**Active Table Sessions** (ActiveTableSessionModule - 1,174 LOC)
- Customer session creation via QR code
- Manual session creation by staff
- Session token generation and validation
- Session status transitions (active, closed, expired)
- Multi-device session support
- Session expiry management

**Authentication:**
- Session token for customer cart operations
- JWT for staff cart operations
- Dual authentication support

**Coverage:** 18.83% ⚠️ (Critical gap - needs improvement)

**API Endpoints:**
- `POST /active-table-sessions/join-by-table/:tableId` - Join/create session (customers)
- `POST /active-table-sessions` - Create manual session (staff)
- `PATCH /active-table-sessions/:id` - Update session status
- `GET /active-table-sessions/:id` - Get session details
- `POST /active-table-sessions/:id/close` - Close session

---

### 🛒 Cart & Ordering

**Shopping Cart** (CartModule - 1,587 LOC)
- Real-time cart synchronization (WebSocket)
- Cart item management (add, update, remove)
- Customization selections
- Cart quantity updates
- Special notes per item
- Cart clearing
- Multi-device cart sync

**Security:**
- Session token validation (customers)
- JWT validation (staff)
- Store isolation enforcement

**Coverage:** 91.09% ✅ (Production-ready)

**WebSocket Events:**
- `cart:add` - Add item to cart
- `cart:update` - Update cart item
- `cart:remove` - Remove cart item
- `cart:clear` - Clear entire cart
- `cart:updated` - Broadcast cart changes

**Order Processing** (OrderModule - 2,930 LOC)
- Cart checkout to order conversion
- Order number generation (YYYYMMDD-XXX format)
- VAT and service charge calculation
- Discount application (percentage/fixed)
- Order status transitions
- Order history per store/user
- Order cancellation
- Order item customization tracking

**Order Statuses:**
- PENDING → CONFIRMED → PREPARING → READY → COMPLETED → CANCELLED

**Coverage:** 95.6% ✅ (Production-ready - highest coverage)

**Decimal Precision:** 96 instances of Decimal arithmetic for financial accuracy

**API Endpoints:**

**Cart:**
- `GET /cart/:sessionId` - Get cart (session token or JWT)
- `POST /cart/:sessionId/items` - Add item to cart
- `PATCH /cart/:sessionId/items/:itemId` - Update cart item
- `DELETE /cart/:sessionId/items/:itemId` - Remove cart item
- `DELETE /cart/:sessionId` - Clear cart
- `POST /cart/:sessionId/checkout` - Checkout cart

**Orders:**
- `GET /order/store/:storeId` - List store orders
- `GET /order/:id` - Get order details
- `PATCH /order/:id/status` - Update order status
- `POST /order/:id/discount` - Apply discount (OWNER/ADMIN)
- `DELETE /order/:id` - Cancel order

---

### 💳 Payment Processing

**Payment Management** (PaymentModule - 2,483 LOC)
- Payment recording per order
- Multiple payment methods (cash, card, digital wallet)
- Split payment support (even split, by item, custom)
- Partial payment tracking
- Refund creation (full/partial)
- Payment summary aggregation
- Transaction history

**Split Payment Methods:**
- **EVEN** - Equal split among payers
- **BY_ITEM** - Split by ordered items
- **CUSTOM** - Custom amount per payer

**Refund Features:**
- Partial refund with reason tracking
- Full order refund
- Refund calculation against payments
- Refund audit trail

**Coverage:** 69.92% ⚠️ (Below 85% target)

**API Endpoints:**
- `POST /payment` - Record payment (CASHIER/OWNER)
- `GET /payment/order/:orderId` - Get order payments
- `GET /payment/store/:storeId/summary` - Payment summary
- `POST /payment/:id/refund` - Create refund
- `GET /payment/:id/refunds` - List refunds

---

### 👨‍🍳 Kitchen Display System (KDS)

**Kitchen Operations** (KitchenModule - 808 LOC)
- Real-time order notifications
- Kitchen order queue
- Order status updates for kitchen staff
- Order filtering by status
- Order preparation tracking
- WebSocket real-time updates

**Features:**
- Automatic order broadcast to kitchen on creation
- Status transitions visible in real-time
- Store-scoped kitchen views
- Order completion workflow

**Coverage:** 90.32% ✅ (Production-ready)

**WebSocket Events:**
- `order:new` - New order notification
- `order:status-update` - Order status changed
- `kitchen:join-store` - Kitchen staff joins store room

**API Endpoints:**
- `GET /kitchen/orders` - Get kitchen orders (CHEF/ADMIN)
- `PATCH /kitchen/orders/:id/status` - Update order status

---

### 📊 Reporting & Analytics

**Business Intelligence** (ReportModule - 1,229 LOC)
- Sales summary reports
- Order status breakdown
- Payment method analysis
- Popular items ranking
- Revenue aggregation
- Time-based reports (daily, weekly, monthly)
- Store performance metrics

**Report Types:**
- Sales summary (total revenue, order count, avg order value)
- Order status distribution
- Payment breakdown by method
- Top selling items
- Hourly/daily sales trends

**Coverage:** 18.25% ⚠️ (Critical gap - minimal testing)

**API Endpoints:**
- `GET /report/sales-summary` - Sales metrics
- `GET /report/order-status` - Order status breakdown
- `GET /report/payment-breakdown` - Payment method analysis
- `GET /report/popular-items` - Best selling items

---

### 📅 Subscription Management

**Subscription & Billing** (SubscriptionModule - Complex, multiple services)

**Tier Management** (TierService - 571 LOC)
- Subscription tier CRUD
- Tier feature limits (stores, users, tables)
- Trial/paid tier differentiation
- Tier upgrade/downgrade

**Subscription Features:**
- Trial period management (7-30 days)
- Automatic subscription renewal
- Payment proof uploads
- Subscription status tracking (trial, active, expired, cancelled)
- Grace period handling
- Ownership transfer
- Refund processing

**Background Jobs:**
- Trial expiration notifications (daily 2 AM)
- Subscription renewal processing (daily 3 AM)
- Usage report generation

**Coverage:** 0% ⚠️ (Critical gap - core revenue feature untested)

**API Endpoints:**
- `GET /subscription/tiers` - List available tiers
- `POST /subscription` - Create subscription
- `PATCH /subscription/:id` - Update subscription
- `POST /subscription/:id/payment-proof` - Upload payment proof
- `POST /subscription/:id/cancel` - Cancel subscription
- `POST /store/:id/transfer-ownership` - Transfer store ownership

---

### 👨‍💼 Admin Platform

**Platform Administration** (AdminModule - Multiple services)

**Admin Capabilities:**
- Platform-level authentication
- Store management (suspend, ban, restore)
- User management (suspend, ban, verify)
- Subscription oversight
- Payment verification
- Audit log tracking
- Platform analytics

**Admin Services:**
- AdminAuthService - Admin authentication
- AdminStoreService - Store suspension/banning
- AdminUserService - User management
- AdminAuditService - Audit trail tracking
- SuspensionService - Suspension logic

**Audit Features:**
- Automatic audit logging for all mutations
- AdminAuditInterceptor logs non-GET requests
- Action tracking (who, what, when, where)

**API Endpoints:**
- `POST /admin/auth/login` - Admin login
- `GET /admin/stores` - List all stores
- `PATCH /admin/stores/:id/suspend` - Suspend store
- `PATCH /admin/stores/:id/ban` - Ban store
- `GET /admin/users` - List all users
- `PATCH /admin/users/:id/suspend` - Suspend user
- `GET /admin/audit-logs` - View audit trail

---

### 📁 File Storage

**AWS S3 Integration** (StorageModule - Multiple services)

**S3 Service Features:**
- File upload to S3
- Pre-signed URL generation
- File retrieval with expiring URLs
- Image optimization with Sharp
- MIME type validation
- File size limits (10MB default)

**Image Processing:**
- Automatic resize and optimization
- Format conversion (JPEG, PNG, WebP)
- Thumbnail generation
- Quality adjustment

**Cleanup Service:**
- Scheduled orphaned file detection
- Monthly cleanup job
- Batch deletion operations

**Coverage:** 0% ⚠️ (Critical gap - 5,448 lines untested)

**Supported Use Cases:**
- Store logos
- Menu item images
- Payment proof uploads
- User profile pictures

---

### ⚡ Real-Time Features

**WebSocket Gateways** (Socket.IO)

**Cart Gateway** (CartGateway)
- Real-time cart synchronization
- Multi-device cart updates
- Session-based room management
- Event broadcasting to session members

**⚠️ Security Issue:** No authentication guards (CVSS 9.1 vulnerability)

**Kitchen Gateway** (KitchenGateway)
- Real-time order notifications
- Kitchen staff order updates
- Store-scoped broadcasting

**Coverage:** 0-19% ⚠️ (WebSocket gateways undertested)

**Table Gateway** (TableGateway)
- Real-time table status updates
- Table availability notifications

---

### ⏰ Background Jobs

**Scheduled Tasks** (JobsModule)

**Jobs:**
1. **TrialExpirationJob** - Daily at 2:00 AM
   - Sends trial expiration notifications
   - Updates trial status

2. **SubscriptionRenewalJob** - Daily at 3:00 AM
   - Processes subscription renewals
   - Sends renewal notifications

3. **OtpCleanupJob** - Periodic
   - Cleans expired OTP codes

4. **UsageReportJob** - Monthly
   - Generates usage statistics
   - Sends usage reports to store owners

**Infrastructure:**
- Bull queue with Redis
- Cron-based scheduling
- Job retry logic
- Email notifications via Nodemailer

---

### 📧 Email Notifications

**Email Service** (EmailModule - 832 LOC)

**Email Types:**
- Trial expiration warnings
- Subscription renewal confirmations
- Payment receipts
- Order confirmations
- User invitations
- Welcome emails
- Password reset (handled by Auth0)

**Template Engine:**
- Handlebars templates (14 templates)
- HTML and plain text versions
- Dynamic content rendering

**Coverage:** 18.18% ⚠️ (Critical gap - email delivery untested)

**⚠️ Note:** Auth0 handles authentication-related emails (verification, password reset)

---

### 🔍 Audit Trail

**Audit Logging** (AuditLogModule)

**Features:**
- Automatic mutation logging
- User action tracking
- Admin action logging
- Entity change history
- Timestamp and user attribution

**Logged Actions:**
- Store creation/updates
- User role changes
- Menu modifications
- Order operations
- Payment transactions
- Admin interventions

---

## Feature Implementation Status

| Feature Area | Status | Coverage | Priority |
|--------------|--------|----------|----------|
| Authentication & Authorization | ✅ Complete | 23.83% | HIGH |
| Store Management | ✅ Complete | 53.10% | MEDIUM |
| User Management | ✅ Complete | 92.06% | LOW |
| Menu & Categories | ✅ Complete | 73-95% | MEDIUM |
| Table Management | ⚠️ Missing soft delete | 86.07% | MEDIUM |
| Session Management | ✅ Complete | 18.83% | HIGH |
| Cart & Ordering | ✅ Complete | 91-96% | LOW |
| Payment Processing | ✅ Complete | 69.92% | HIGH |
| Kitchen Display System | ✅ Complete | 90.32% | LOW |
| Reporting & Analytics | ✅ Complete | 18.25% | HIGH |
| Subscription Management | ✅ Complete | 0% | CRITICAL |
| Admin Platform | ✅ Complete | Unknown | HIGH |
| File Storage | ✅ Complete | 0% | CRITICAL |
| Real-Time Features | ⚠️ Security issues | 0-19% | CRITICAL |
| Background Jobs | ✅ Complete | Unknown | MEDIUM |
| Email Notifications | ✅ Complete | 18.18% | HIGH |
| Audit Trail | ✅ Complete | Unknown | MEDIUM |

**Legend:**
- ✅ Complete - Feature fully implemented
- ⚠️ Issues - Feature complete but has known issues
- ❌ Incomplete - Feature partially implemented or missing

---

## Development Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose (for database services)
- **Auth0 Account** (required for authentication)
- **PostgreSQL** client tools (optional, for CLI access)

### Local Development Philosophy

This project follows a **hybrid approach** for local development:

- **Application**: Runs natively on your machine for fast development
- **Services**: Run in Docker containers (PostgreSQL)

**Benefits:**
- ✅ Fast hot reload (no container overhead)
- ✅ Easy debugging with your IDE
- ✅ Native performance
- ✅ Simple Docker setup (services only)

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd origin-food-house-backend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

   **Required Configuration:**
   - **Auth0 credentials** (OAuth2/OIDC) - See [Auth0 Setup](#auth0-setup)
   - **Database connection** string
   - **JWT secret** for internal tokens
   - **CORS origins** for frontend apps

4. **Start infrastructure services:**
   ```bash
   npm run docker:up
   ```

5. **Initialize database:**
   ```bash
   npm run migrate:db    # Run migrations
   npm run generate:db   # Generate Prisma client
   npm run seed:db       # Seed demo data
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

### Auth0 Setup

This application **exclusively** uses Auth0 for authentication. Local email/password login is **NOT supported**.

1. **Create Auth0 Application:**
   - Go to [Auth0 Dashboard](https://manage.auth0.com/)
   - Create a new "Regular Web Application"
   - Configure Allowed Callback URLs, Logout URLs, and Web Origins

2. **Configure Environment Variables:**
   ```env
   AUTH0_DOMAIN="your-tenant.auth0.com"
   AUTH0_CLIENT_ID="your-client-id"
   AUTH0_CLIENT_SECRET="your-client-secret"
   AUTH0_AUDIENCE="https://api.your-domain.com"
   AUTH0_ISSUER="https://your-tenant.auth0.com/"
   ```

3. **See Full Guide:**
   - [docs/AUTH0_INTEGRATION.md](docs/AUTH0_INTEGRATION.md)

---

## Docker Services

### Overview

Docker Compose provides **ONLY** the infrastructure services needed for development. The application runs natively on your machine.

### Services Provided

#### PostgreSQL Database
- **Image:** `postgres:16-alpine`
- **Port:** `5432` (configurable via `POSTGRES_PORT`)
- **Access:** `localhost:5432`
- **Credentials:** Set in `.env` file
- **Volume:** `postgres-data` (persistent storage)

### Docker Commands

```bash
# Start services
npm run docker:up

# View service logs
npm run docker:logs

# Check service status
npm run docker:ps

# Stop services
npm run docker:down

# Stop and remove volumes (⚠️ deletes database data)
npm run docker:clean
```

### Manual Docker Compose Commands

```bash
# Start services in detached mode
docker compose up -d

# View logs
docker compose logs -f postgres

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v
```

---

## Database Management

### Prisma Commands

```bash
# Run migrations (development)
npm run migrate:db

# Generate Prisma client
npm run generate:db

# Open Prisma Studio (GUI)
npm run studio:db

# Seed database
npm run seed:db

# Reset database (⚠️ destructive)
npm run reset:db

# Drop and recreate database (⚠️ very destructive)
npm run drop:db
```

### Database Schema

**19 Prisma Models:**
- User, Store, UserStore (multi-tenancy)
- StoreInformation, StoreSetting (store config)
- Category, MenuItem, CustomizationGroup, CustomizationOption (menu)
- Table, ActiveTableSession (table management)
- Cart, CartItem, CartItemCustomization (shopping cart)
- Order, OrderItem, OrderItemCustomization (order processing)
- Payment, Refund (payment processing)

**Key Features:**
- Soft deletes (`deletedAt` timestamp)
- Audit trails (`createdAt`, `updatedAt`)
- Decimal precision for monetary values
- Multi-tenant isolation via `storeId`

### Direct PostgreSQL Access

```bash
# Using psql (if installed locally)
psql postgresql://myuser:mypassword@localhost:5432/mydb

# Using Docker exec
docker exec -it origin-food-house-postgres psql -U myuser -d mydb
```

### Database GUI Tools

For database management, you can use:
- **Prisma Studio:** `npm run studio:db` (included)
- **TablePlus, DBeaver, pgAdmin (desktop):** Connect to `localhost:5432`

---

## Available Scripts

### Development

```bash
npm run dev              # Start development server with hot reload
npm run start            # Start without watch mode
npm run start:debug      # Start with debugger attached
```

### Build & Production

```bash
npm run build            # Build for production
npm run start:prod       # Start production server
```

### Code Quality

```bash
npm run lint             # Lint and fix code (ESLint)
npm run format           # Format code (Prettier)
```

### Testing

```bash
npm test                 # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:cov         # Run tests with coverage
npm run test:e2e         # Run end-to-end tests
npm run test:debug       # Debug tests
```

**⚠️ Known Issue:** 11 of 17 test suites currently fail to compile due to TypeScript errors. See [Quality Assurance Report](docs/quality-assurance/audits/2025-10-28-comprehensive-qa-assessment.md).

### Docker

```bash
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
npm run docker:logs      # View service logs
npm run docker:ps        # Check service status
npm run docker:clean     # Stop and remove volumes
```

### Database

```bash
npm run migrate:db       # Run Prisma migrations
npm run generate:db      # Generate Prisma client
npm run studio:db        # Open Prisma Studio
npm run seed:db          # Seed database
npm run reset:db         # Reset database
npm run drop:db          # Drop database
```

---

## Project Structure

```
origin-food-house-backend/
├── src/
│   ├── active-table-session/    # Session management & lifecycle
│   ├── admin/                   # Admin-specific functionality
│   ├── audit-log/               # Audit trail tracking
│   ├── auth/                    # Auth0 integration, JWT, RBAC
│   ├── cart/                    # Shopping cart + WebSocket sync
│   ├── category/                # Menu category management
│   ├── common/                  # Shared utilities, decorators, guards
│   ├── customization/           # Menu item customizations
│   ├── email/                   # Email notifications (Nodemailer)
│   ├── jobs/                    # Background jobs (subscription renewal, trial expiration)
│   ├── kitchen/                 # Kitchen Display System (KDS) + WebSocket
│   ├── menu/                    # Menu items & pricing
│   ├── order/                   # Order processing, VAT/service charge
│   ├── payment/                 # Payment recording & refunds
│   ├── prisma/                  # Prisma service (database client)
│   ├── redis/                   # Redis integration (caching, Bull)
│   ├── report/                  # Analytics & business intelligence
│   ├── storage/                 # AWS S3 file storage + Sharp image processing
│   ├── store/                   # Store management, settings
│   ├── subscription/            # Subscription tiers & billing
│   ├── table/                   # Table entities, QR codes
│   ├── tier/                    # Subscription tier management
│   ├── user/                    # User profiles, Auth0 sync
│   ├── app.module.ts            # Root application module
│   └── main.ts                  # Application entry point
├── prisma/
│   ├── schema.prisma            # Database schema (19 models)
│   ├── migrations/              # Database migrations
│   └── seed.ts                  # Seed data script
├── test/                        # E2E tests
├── docs/                        # Comprehensive documentation
│   ├── MASTER_REFACTORING_PLAN.md  # Overall refactoring roadmap
│   ├── CODEBASE_ANALYSIS_REPORT.md # Detailed code analysis
│   ├── security-audit/          # Security vulnerability reports
│   ├── solution-architect/      # Architecture documentation
│   └── quality-assurance/       # QA reports & test plans
├── docker/
│   └── archive/                 # Old Docker configs (reference)
├── docker-compose.yml           # Infrastructure services (PostgreSQL)
├── Dockerfile                   # Production build (multi-stage)
├── .env.example                 # Environment template
├── CLAUDE.md                    # Development guidelines
└── package.json                 # Dependencies & scripts
```

---

## Architecture Overview

### Modular Architecture

**14 Domain Modules:**
1. **AuthModule** - Auth0, JWT, RBAC (23.83% test coverage)
2. **StoreModule** - Multi-store management (53.10% coverage)
3. **UserModule** - User profiles, Auth0 sync (60.86% coverage)
4. **MenuModule** - Menu items, pricing (56.41% coverage)
5. **CategoryModule** - Category CRUD, sorting (59.48% coverage)
6. **CustomizationModule** - Menu customizations
7. **TableModule** - Table management, QR codes (62.10% coverage)
8. **ActiveTableSessionModule** - Session lifecycle (18.83% coverage)
9. **CartModule** - Shopping cart + WebSocket (49.07% coverage)
10. **OrderModule** - Order processing (78.02% coverage ✅)
11. **PaymentModule** - Payments, refunds (53.75% coverage)
12. **KitchenModule** - KDS + WebSocket (56.00% coverage)
13. **ReportModule** - Analytics (0% coverage ⚠️)
14. **SubscriptionModule** - Billing, tiers (0% coverage ⚠️)

**Infrastructure Modules:**
- PrismaModule, RedisModule, EmailModule, StorageModule, JobsModule, AdminModule, AuditLogModule, TierModule, CommonModule

### Design Patterns

- **Multi-Tenancy:** Store-scoped data isolation
- **Soft Deletes:** Audit trails with `deletedAt`
- **RBAC:** 5 roles (Owner, Admin, Chef, Cashier, Server)
- **Event-Driven:** WebSocket gateways for real-time features
- **Repository Pattern:** Prisma service abstraction
- **DTO Validation:** class-validator decorators
- **Error Handling:** Centralized exception filters

### Authentication Flow

**Staff Users (POS App):**
1. Auth0 Universal Login (OAuth2/OIDC)
2. Token validation via JWKS
3. User sync to database
4. Store selection
5. Store-scoped JWT

**Customers (SOS App):**
1. QR code scan
2. Table session creation
3. Session JWT
4. Order placement

---

## Environment Variables

See `.env.example` for a complete list of environment variables.

### Required Variables

```env
# Node Environment
NODE_ENV="dev"
PORT=3000

# Database
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb"

# Auth0 (Required - exclusive authentication provider)
AUTH0_DOMAIN="your-tenant.auth0.com"
AUTH0_CLIENT_ID="your-client-id"
AUTH0_CLIENT_SECRET="your-client-secret"
AUTH0_AUDIENCE="https://api.your-domain.com"
AUTH0_ISSUER="https://your-tenant.auth0.com/"

# JWT (Internal tokens)
JWT_SECRET="your-secret-key-minimum-32-characters"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="7d"

# CORS (Frontend origins)
CORS_ORIGIN="http://localhost:3001,http://localhost:3002"
```

### Optional Variables

```env
# AWS S3 (File uploads - optional)
AWS_ACCESS_KEY_ID="your-key"
AWS_SECRET_ACCESS_KEY="your-secret"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-bucket"

# Email (SMTP - optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="noreply@yourdomain.com"

# Redis (Background jobs - optional)
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
```

**Security Notes:**
- Use **strong, unique secrets** for JWT_SECRET (minimum 32 characters)
- **Never commit** `.env` files to version control
- Use **environment-specific** configuration for production
- Validate all environment variables at startup using ConfigService

---

## Testing

### Test Status

**Current State (October 28, 2025):**
- **Total Test Suites:** 17 suites
- **Compiling Suites:** 6/17 (35%)
- **Failing Suites:** 11/17 (65%)
- **Tests Passing:** ~100 tests (exact count unknown due to compilation errors)
- **Overall Coverage:** 31.7% statement coverage

**Critical Gaps:**
- ❌ **SubscriptionModule:** 0% coverage (core revenue feature)
- ❌ **ReportModule:** 18.25% coverage (analytics untested)
- ❌ **StorageModule:** 0% coverage (5,448 lines untested)
- ❌ **WebSocket Gateways:** 0-19% coverage

### Running Tests

```bash
# Unit tests
npm test

# Watch mode (recommended for development)
npm run test:watch

# Coverage report
npm run test:cov

# End-to-end tests
npm run test:e2e
```

### Test Patterns

```typescript
// Example: Service test with Prisma mock
import { createPrismaMock } from '../common/testing/prisma-mock.helper';

describe('StoreService', () => {
  let service: StoreService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        StoreService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
  });

  it('should create a store with default settings', async () => {
    const dto = { name: 'Test Store', slug: 'test-store' };
    const userId = 'auth0|123';

    prismaMock.$transaction.mockImplementation((callback) =>
      callback(prismaMock)
    );

    const result = await service.createStore(userId, dto);

    expect(result).toBeDefined();
    expect(result.name).toBe('Test Store');
  });
});
```

### Test Coverage Goals

| Module | Current | Target | Priority |
|--------|---------|--------|----------|
| OrderModule | 78.02% | 85%+ | ✅ Met |
| CartModule | 49.07% | 85%+ | 🟡 High |
| PaymentModule | 53.75% | 85%+ | 🟡 High |
| SubscriptionModule | 0% | 85%+ | 🔴 Critical |
| StorageModule | 0% | 80%+ | 🔴 Critical |
| ReportModule | 18.25% | 80%+ | 🔴 Critical |

**See:** [Quality Assurance Assessment](docs/quality-assurance/audits/2025-10-28-comprehensive-qa-assessment.md)

---

## Security

### Known Security Issues

> **⚠️ PRODUCTION BLOCKER:** Critical vulnerabilities present

**Priority 0 (IMMEDIATE FIX REQUIRED):**
1. **WebSocket Authentication Bypass** (CVSS 9.1)
   - `src/cart/cart.gateway.ts` - No authentication guards
   - **Impact:** Cart manipulation, session hijacking, financial fraud

2. **Session Token Exposure** (CVSS 8.9)
   - `src/active-table-session/active-table-session.controller.ts`
   - **Impact:** Session hijacking, GDPR violation

3. **Checkout Authentication Bypass** (CVSS 8.6)
   - `src/cart/cart.controller.ts`
   - **Impact:** Unauthorized order creation

4. **Missing Store Isolation** (CVSS 7.8)
   - `src/active-table-session/active-table-session.service.ts`
   - **Impact:** Cross-store data access

**See Full Report:** [Security Audit](docs/security-audit/2025-10-28-comprehensive-security-audit.md)

### Security Best Practices

- ✅ **Auth0 Integration:** Industry-standard OAuth2/OIDC
- ✅ **RBAC Enforcement:** Role-based access control
- ✅ **Input Validation:** class-validator decorators
- ✅ **Soft Deletes:** Audit trails preserved
- ✅ **ConfigService Usage:** No direct `process.env` access
- ⚠️ **WebSocket Security:** Needs authentication guards
- ⚠️ **Rate Limiting:** Basic implementation (needs enhancement)

### Security Checklist

- [ ] Fix all P0 security vulnerabilities
- [ ] Add WebSocket authentication guards
- [ ] Remove session tokens from API responses
- [ ] Implement comprehensive rate limiting
- [ ] Add security audit logging
- [ ] Configure security headers (Helmet)
- [ ] Implement account lockout policies
- [ ] Setup penetration testing

---

## Deployment

### Production Readiness Status

**Current Status:** ❌ **NOT PRODUCTION READY**

**Blockers:**
- 🔴 4 critical security vulnerabilities
- 🔴 11 failing test suites
- 🟡 31.7% test coverage (target: 80%+)
- 🟡 Performance issues (2-5s response times)

**Estimated Timeline:** 10-12 weeks

### Production Dockerfile

For production deployment, use the `Dockerfile` in the project root:

```bash
# Build production image
docker build -t origin-food-house-backend:latest .

# Run production container (example)
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH0_DOMAIN="..." \
  -e JWT_SECRET="..." \
  --name origin-backend \
  origin-food-house-backend:latest
```

**Dockerfile Features:**
- Multi-stage build (builder + production)
- Alpine Linux base (minimal size)
- Non-root user (security)
- Health check endpoint
- Prisma client pre-generated
- Startup script handles migrations

### Environment-Specific Deployments

- **AWS ECS/Fargate:** Use Dockerfile with ECS task definitions
- **Kubernetes:** Create deployment manifests referencing Docker image
- **Docker Compose (Production):** Create separate `docker-compose.prod.yml`
- **Heroku/Railway:** Use Procfile with migrations

### Pre-Deployment Checklist

**Phase 1: Critical Fixes (Week 1-2)**
- [ ] Fix 4 P0 security vulnerabilities
- [ ] Fix 11 failing test suites
- [ ] Verify all tests pass
- [ ] Security audit score: 8.0/10+

**Phase 2: Quality (Week 3-5)**
- [ ] Test coverage ≥80% on critical modules
- [ ] Integration tests for critical flows
- [ ] Performance testing completed

**Phase 3: Infrastructure (Week 6-8)**
- [ ] Database indexes optimized
- [ ] Redis caching implemented
- [ ] API response times <500ms (p95)

**Phase 4: Production (Week 9-12)**
- [ ] Observability dashboard operational
- [ ] Health checks configured
- [ ] Backup and disaster recovery tested
- [ ] Documentation complete
- [ ] CI/CD pipeline with quality gates

**See:** [Master Refactoring Plan](docs/MASTER_REFACTORING_PLAN.md)

---

## Documentation

### Primary Documentation

- **[MASTER_REFACTORING_PLAN.md](docs/MASTER_REFACTORING_PLAN.md)** - ⭐ Start here for overall roadmap
- **[CLAUDE.md](CLAUDE.md)** - Development guidelines and architectural principles
- **[.env.example](.env.example)** - Environment variable reference

### Comprehensive Analysis Reports

**Codebase Analysis:**
- [Codebase Analysis Report](CODEBASE_ANALYSIS_REPORT.md) - 932 lines of structural analysis
- [Analysis Summary](ANALYSIS_SUMMARY.md) - Quick reference guide
- [Analysis Index](ANALYSIS_INDEX.md) - Navigation guide

**Security:**
- [Comprehensive Security Audit](docs/security-audit/2025-10-28-comprehensive-security-audit.md)
- [Security Executive Summary](docs/security-audit/EXECUTIVE_SUMMARY.md)

**Architecture:**
- [Architecture Review](docs/solution-architect/architecture/2025-10-28-comprehensive-architecture-review.md)
- [Architecture Diagrams](docs/solution-architect/architecture/2025-10-28-architecture-diagrams.md)
- [Scalability Roadmap](docs/solution-architect/scaling/2025-10-28-scalability-roadmap.md)

**Quality Assurance:**
- [QA Assessment](docs/quality-assurance/audits/2025-10-28-comprehensive-qa-assessment.md)
- [QA Executive Summary](docs/quality-assurance/test-reports/2025-10-28-qa-executive-summary.md)
- [Subscription Module Test Plan](docs/quality-assurance/test-plans/2025-10-28-subscription-module-test-plan.md)

### Technical Documentation

- **[Auth0 Integration Guide](docs/AUTH0_INTEGRATION.md)** - Authentication setup
- **[Business Documentation](docs/BUSINESS_DOC_V1.md)** - Business logic and workflows
- **[Technical Documentation](docs/TECHNICAL_DOC_V1.md)** - Technical architecture
- **[Docker Setup Guide](DOCKER_SETUP.md)** - Docker configuration

### API Documentation

- **Swagger UI:** `http://localhost:3000/api/docs` (when server is running)
- **OpenAPI Spec:** `http://localhost:3000/api/docs-json`

---

## Project Statistics

| Metric | Value | Status |
|--------|-------|--------|
| **Lines of Code** | 39,637 | - |
| **Domain Modules** | 14 | ✅ |
| **Infrastructure Modules** | 10 | ✅ |
| **Database Models** | 19 | ✅ |
| **Test Suites** | 17 | 🔴 11 failing |
| **Passing Tests** | ~100 | ⚠️ Unknown (compilation errors) |
| **Test Coverage** | 31.7% | 🔴 Target: 80%+ |
| **Dependencies** | 49 | ✅ Up-to-date |
| **Dev Dependencies** | 34 | ✅ |
| **Security Vulnerabilities** | 4 P0 | 🔴 Critical |

---

## Support & Contributing

### Getting Help

1. **Check Documentation:**
   - Start with [MASTER_REFACTORING_PLAN.md](docs/MASTER_REFACTORING_PLAN.md)
   - Review [CLAUDE.md](CLAUDE.md) for guidelines
   - Search through analysis reports in `docs/`

2. **Common Issues:**
   - Test compilation errors: See [QA Assessment](docs/quality-assurance/audits/2025-10-28-comprehensive-qa-assessment.md)
   - Security concerns: See [Security Audit](docs/security-audit/2025-10-28-comprehensive-security-audit.md)
   - Architecture questions: See [Architecture Review](docs/solution-architect/architecture/2025-10-28-comprehensive-architecture-review.md)

3. **Docker Issues:**
   - Check archived configs in `docker/archive/`
   - Review [Docker Setup Guide](DOCKER_SETUP.md)

### Development Guidelines

**Before Starting Development:**
1. Read [CLAUDE.md](CLAUDE.md) for architectural principles
2. Review the [Master Refactoring Plan](docs/MASTER_REFACTORING_PLAN.md)
3. Check for open issues in the relevant analysis report
4. Follow the established patterns and conventions

**Quality Gates (Every Task):**
1. ✅ Code formatted (`npm run format`)
2. ✅ Linting passes (`npm run lint`)
3. ✅ Type checking passes (`npx tsc --noEmit`)
4. ✅ Tests pass (`npm test`)
5. ✅ Build succeeds (`npm run build`)

**See:** [Development Workflow](CLAUDE.md#development-workflow)

---

## License

**UNLICENSED** - Private project

---

## Acknowledgments

Built with:
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [Auth0](https://auth0.com/) - Authentication platform
- [PostgreSQL](https://www.postgresql.org/) - Relational database
- [Socket.IO](https://socket.io/) - Real-time engine

---

**Last Updated:** October 28, 2025
**Version:** 0.0.1 (Development)
**Status:** ⚠️ Under Active Development - Not Production Ready
