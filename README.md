# Origin Food House - Backend

A comprehensive **multi-tenant restaurant management system** built with NestJS, Prisma ORM, and PostgreSQL. The platform enables restaurant owners to manage multiple locations, handle table-based dining sessions, process orders in real-time, and maintain complete control over their operations through role-based access.

[![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Enabled-010101?logo=socket.io)](https://socket.io/)

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Development Commands](#development-commands)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Authentication & Authorization](#authentication--authorization)
- [Real-Time Features](#real-time-features)
- [Testing](#testing)
- [Docker Deployment](#docker-deployment)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Functionality

- **Multi-Store Management**: Manage multiple restaurant locations from a single platform with unique slugs and isolated data
- **Real-Time Cart Synchronization**: WebSocket-based live updates for cart changes across all devices in a session
- **Complex Menu Customization**: Support for nested customization groups with min/max selection constraints and dynamic pricing
- **Table Session Management**: QR code-based customer sessions with automatic table assignment
- **Role-Based Access Control**: Granular permissions for Owner, Admin, Chef, Cashier, and Server roles
- **Order Processing**: Complete order lifecycle from cart to kitchen to payment with status tracking
- **Image Management**: AWS S3 integration for menu item images with automatic cleanup of unused files
- **Soft Delete Pattern**: Non-destructive deletion preserving audit trails and historical data
- **Customer Requests**: In-session customer service requests (call staff, request bill) with status tracking
- **Payment Processing**: Automated billing with VAT and service charge calculations with rate snapshots
- **Pagination Support**: Built-in pagination with metadata for list endpoints

### Business Features

- **Customer Self-Service**: Contactless ordering via QR codes
- **Kitchen Display Integration**: Real-time order status updates for kitchen workflow
- **Staff Management**: Invite users and assign roles per store
- **Menu Organization**: Categories with drag-and-drop sorting
- **Price Locking**: Historical price accuracy with snapshots
- **Multi-Currency Support**: THB, USD, EUR, JPY, CNY, SGD, HKD, MMK

---

## Technology Stack

### Core Technologies

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | NestJS | 11.x |
| **Language** | TypeScript | 5.x |
| **ORM** | Prisma | 6.x |
| **Database** | PostgreSQL | 16+ |
| **Real-Time** | Socket.IO | Latest |
| **Authentication** | Auth0 + JWT + Passport | Latest |
| **File Storage** | AWS S3 | SDK v3 |
| **Email** | Nodemailer | 7.x |

### Key Dependencies

- **Authentication**: express-jwt, jwks-rsa, @nestjs/passport, passport-jwt
- **Validation**: class-validator, class-transformer
- **Security**: bcrypt (12 salt rounds), @nestjs/throttler (rate limiting)
- **Image Processing**: Sharp
- **Scheduling**: @nestjs/schedule (cron jobs)
- **API Documentation**: @nestjs/swagger
- **Utilities**: slugify, nanoid, uuid v7, centralized password utilities

### Development Tools

- **Testing**: Jest, Supertest
- **Code Quality**: ESLint, Prettier
- **Git Hooks**: Husky, lint-staged
- **API Testing**: Postman collection sync

---

## Architecture

### System Design

Origin Food House follows a **modular monolithic architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│         (Web App, Mobile App, QR Code Scanner)               │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST & WebSocket
┌────────────────────▼────────────────────────────────────────┐
│                    API Gateway Layer                         │
│        (Controllers, Guards, Middleware, Pipes)              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                 Business Logic Layer                         │
│    (Services, Domain Logic, Validation, Events)              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Data Access Layer                           │
│              (Prisma ORM, Repositories)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                Infrastructure Layer                          │
│        (PostgreSQL, AWS S3, Email Service)                   │
└─────────────────────────────────────────────────────────────┘
```

### Core Modules

- **AuthModule**: Auth0 integration, JWT authentication, role-based access control, user synchronization
- **UserModule**: User profiles, registration, store membership
- **StoreModule**: Multi-store management, settings, staff assignment
- **MenuModule**: Menu items with complex customizations
- **CategoryModule**: Menu category organization
- **TableModule**: Physical table management
- **ActiveTableSessionModule**: Table session lifecycle
- **CartModule**: Real-time shopping cart with WebSocket
- **CommonModule**: Shared utilities, S3 service, error handling, pagination, password utilities
- **EmailModule**: Email notifications and verification

---

## Getting Started

### Prerequisites

- **Node.js**: 18.x or 20.x
- **npm**: 9.x or higher
- **PostgreSQL**: 14+ (16+ recommended)
- **Docker** (optional): For containerized deployment
- **AWS Account** (optional): For S3 image storage

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd origin-food-house-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start PostgreSQL** (via Docker or local installation)
   ```bash
   # Using Docker Compose
   docker-compose up -d postgres

   # Or use your local PostgreSQL instance
   ```

5. **Run database migrations**
   ```bash
   npm run migrate:db
   ```

6. **Generate Prisma Client**
   ```bash
   npm run generate:db
   ```

7. **Seed the database** (optional, creates test data)
   ```bash
   npm run seed:db
   # Default credentials: owner@test.com / test1234
   ```

8. **Start the development server**
   ```bash
   npm run dev
   ```

9. **Access the application**
   - API: http://localhost:3000
   - Swagger Docs: http://localhost:3000/api-docs
   - Prisma Studio: `npm run studio:db`

---

## Development Commands

### Database Operations

| Command | Description |
|---------|-------------|
| `npm run migrate:db` | Run Prisma migrations |
| `npm run generate:db` | Generate Prisma client |
| `npm run studio:db` | Open Prisma Studio GUI |
| `npm run seed:db` | Seed database with demo data |
| `npm run reset:db` | Reset database (⚠️ removes all data) |
| `npm run drop:db` | Drop and recreate schema (⚠️ destructive) |

### Development & Build

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload (port 3000) |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production server |
| `npm run lint` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Generate test coverage report |
| `npm run test:e2e` | Run end-to-end tests |

### Utilities

| Command | Description |
|---------|-------------|
| `npm run sync:postman` | Sync Postman collection |

---

## Environment Variables

Create a `.env` file in the root directory with the following variables:

### Required Variables

```env
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/origin_food_house?schema=public"

# Application
NODE_ENV="dev"
PORT=3000

# Auth0 Configuration (Required for Auth0 authentication)
AUTH0_DOMAIN="your-tenant.auth0.com"
AUTH0_CLIENT_ID="your-client-id"
AUTH0_CLIENT_SECRET="your-client-secret"
AUTH0_AUDIENCE="https://api.your-domain.com"
AUTH0_ISSUER="https://your-tenant.auth0.com/"

# JWT Authentication (Still required for internal tokens)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="7d"

# CORS Configuration
CORS_ORIGIN="http://localhost:3001,http://localhost:3002"
```

### Optional Variables (AWS S3)

```env
# AWS S3 Configuration (Optional - for image uploads)
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-bucket-name"
```

### Optional Variables (Email)

```env
# SMTP Email Configuration (Optional - for email notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="noreply@originfoodhouse.com"
```

> **Note**: See `.env.example` for a complete template

---

## API Documentation

### Interactive Swagger Documentation

Once the server is running, access the interactive API documentation:

**URL**: http://localhost:3000/api-docs

The Swagger UI provides:
- Complete API endpoint listing
- Request/response schemas
- Authentication bearer token testing
- Try-it-out functionality

### Key Endpoints

#### Authentication
- `GET /auth/auth0/config` - Get Auth0 configuration
- `POST /auth/auth0/validate` - Validate Auth0 token and sync user
- `GET /auth/auth0/profile` - Get user profile (Auth0 protected)
- `POST /auth/login/store` - Store selection (after Auth0 authentication)

#### Store Management
- `POST /stores` - Create new store (Owner)
- `GET /stores/:storeId` - Get store details (Public)
- `PATCH /stores/:storeId/information` - Update store info (Owner/Admin)
- `PATCH /stores/:storeId/settings` - Update settings (Owner/Admin)
- `POST /stores/:storeId/invite` - Invite user to store (Owner)

#### Menu Management
- `GET /menu?storeId=...` - Public menu listing
- `POST /menu/:storeId` - Create menu item (Owner/Admin)
- `PUT /menu/:storeId/item/:itemId` - Update menu item (Owner/Admin)
- `DELETE /menu/:storeId/item/:itemId` - Delete menu item (Owner/Admin)

#### Table Sessions
- `POST /active-table-sessions/:storeId` - Create session (Staff)
- `POST /active-table-sessions/join-by-table/:tableId` - Join session (Customer)
- `DELETE /active-table-sessions/:sessionId` - Close session (Staff)

#### WebSocket Events (Cart)
- `cart:get` - Retrieve current cart
- `cart:add` - Add item to cart
- `cart:update` - Update cart item
- `cart:remove` - Remove cart item
- `cart:clear` - Clear all items
- `cart:updated` - (Server → Client) Cart state changed

---

## Database Schema

### Key Entity Relationships

```
User ←→ UserStore ←→ Store
                      ├── StoreInformation (1:1)
                      ├── StoreSetting (1:1)
                      ├── Category (1:N)
                      │   └── MenuItem (1:N)
                      │       └── CustomizationGroup (1:N)
                      │           └── CustomizationOption (1:N)
                      ├── Table (1:N)
                      │   └── ActiveTableSession (1:1)
                      │       ├── Cart (1:1)
                      │       │   └── CartItem (1:N)
                      │       ├── ActiveOrder (1:1)
                      │       │   └── ActiveOrderChunk (1:N)
                      │       │       └── ActiveOrderChunkItem (1:N)
                      │       └── CustomerRequest (1:N)
                      └── Order (1:N)
                          └── OrderItem (1:N)
                              └── OrderItemCustomization (1:N)
```

### Important Design Patterns

- **UUID v7**: All entities use time-sortable UUIDs
- **Soft Delete**: `deletedAt` timestamp for non-destructive deletion
- **Multi-Tenancy**: Every entity scoped to `storeId`
- **Price Snapshots**: Historical accuracy with immutable order records
- **Decimal Precision**: Prisma.Decimal for all monetary values

---

## Authentication & Authorization

### Auth0 Authentication Flow (Recommended)

1. **Frontend**: User authenticates with Auth0
2. **Auth0 Validation**: `POST /auth/auth0/validate` with Bearer token
   - Validates Auth0 token
   - Syncs user to local database
   - Returns internal JWT
3. **Store Selection**: `POST /auth/login/store` with internal JWT
   - Selects active store
   - Returns JWT with store context

### Role Hierarchy

| Role | Permissions |
|------|-------------|
| **OWNER** | Full access to store, can assign all roles |
| **ADMIN** | Manage menu, categories, invite staff (except OWNER) |
| **CHEF** | View orders, update preparation status |
| **CASHIER** | Create sessions, process payments |
| **SERVER** | Create sessions, manage customer requests |

### Customer Session Authentication

- QR code scan → Automatic session join/creation
- Session JWT contains only session ID (no user identity)
- Used for cart operations and customer requests

---

## Real-Time Features

### WebSocket Implementation

**Technology**: Socket.IO with NestJS WebSockets

**Features**:
- Room-based broadcasting (session-specific)
- Automatic reconnection
- Event-driven architecture
- Real-time cart synchronization

**Connection Flow**:
1. Customer scans QR code
2. Receives session JWT token
3. Connects to WebSocket with token
4. Joins session-specific room
5. Receives live updates for cart/order changes

**Events**:
- Cart operations: add, update, remove, clear
- Cart updates: broadcast to all devices in session
- Error handling: client-specific error messages

---

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run in watch mode
npm run test:watch

# Generate coverage report
npm run test:cov
```

### E2E Tests

```bash
# Run end-to-end tests
npm run test:e2e
```

### Test Coverage Goals

- Services: 80%+
- Controllers: 70%+
- Critical paths (auth, payments): 100%

---

## Docker Deployment

### Using Docker Compose

1. **Build and start services**
   ```bash
   docker-compose up -d
   ```

2. **Run migrations** (first time only)
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

3. **Seed database** (optional)
   ```bash
   docker-compose exec backend npm run seed:db
   ```

4. **View logs**
   ```bash
   docker-compose logs -f backend
   ```

5. **Stop services**
   ```bash
   docker-compose down
   ```

### Production Deployment

See `Dockerfile` and `Dockerfile.dev` for production and development builds.

**Key considerations**:
- Set `NODE_ENV=production`
- Use strong JWT secrets
- Configure CORS for your domain
- Set up AWS S3 for file uploads
- Configure SMTP for email notifications
- Use connection pooling for database
- Set up health checks and monitoring

---

## Project Structure

```
origin-food-house-backend/
├── prisma/
│   ├── migrations/          # Database migrations
│   ├── schema.prisma        # Prisma schema definition
│   └── seed.ts              # Database seeding script
├── src/
│   ├── active-table-session/  # Table session management
│   ├── auth/                  # Authentication & authorization
│   ├── cart/                  # Shopping cart + WebSocket
│   ├── category/              # Menu categories
│   ├── common/                # Shared utilities, S3, decorators
│   ├── email/                 # Email service
│   ├── menu/                  # Menu items + customizations
│   ├── store/                 # Store management
│   ├── table/                 # Physical table management
│   ├── user/                  # User profiles
│   ├── app.module.ts          # Root application module
│   └── main.ts                # Application entry point
├── test/                    # E2E tests
├── docs/                    # Detailed documentation
│   ├── BUSINESS_DOC_V1.md   # Business logic & workflows
│   └── TECHNICAL_DOC_V1.md  # Technical architecture
├── docker-compose.yml       # Docker services configuration
├── Dockerfile               # Production Docker image
├── Dockerfile.dev           # Development Docker image
├── .env.example             # Environment variables template
├── CLAUDE.md                # AI development guidance
└── package.json             # Dependencies & scripts
```

---

## Documentation

### Comprehensive Guides

- **[Auth0 Integration](docs/AUTH0_INTEGRATION.md)**: Complete Auth0 setup, configuration, and migration guide
- **[Business Documentation](docs/BUSINESS_DOC_V1.md)**: Business logic, workflows, user roles, and use cases
- **[Technical Documentation](docs/TECHNICAL_DOC_V1.md)**: Architecture, database schema, design patterns, and implementation details
- **[CLAUDE.md](CLAUDE.md)**: Development guidelines and patterns for AI-assisted development

### Quick Links

- **API Docs**: http://localhost:3000/api-docs
- **Prisma Studio**: `npm run studio:db`
- **Swagger JSON**: http://localhost:3000/api-docs-json

---

## Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch
3. **Update** the database schema if needed (Prisma migrations)
4. **Write** or update tests
5. **Run** linting and tests
6. **Commit** with conventional commit messages
7. **Submit** a pull request

### Code Quality

- ESLint for code linting
- Prettier for code formatting
- Husky for git hooks (pre-commit, commit-msg)
- lint-staged for staged file validation

### Commit Message Convention

```
type(scope): subject

feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

---

## License

**UNLICENSED** - Private/proprietary project

---

## Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Check the [Technical Documentation](docs/TECHNICAL_DOC_V1.md)
- Review the [Business Documentation](docs/BUSINESS_DOC_V1.md)

---

## Roadmap

### Phase 2: Enhanced Operations (Q2 2025)
- Kitchen display system integration
- Table occupancy analytics
- Staff performance tracking
- Inventory management basics

### Phase 3: Customer Experience (Q3 2025)
- Customer accounts and profiles
- Order history and favorites
- Loyalty points program
- Reservations system

### Phase 4: Advanced Analytics (Q4 2025)
- Sales reporting dashboard
- Menu item performance analysis
- Peak hours identification
- Financial projections

### Phase 5: Ecosystem Integration (Q1 2026)
- POS system integration
- Third-party delivery platforms
- Accounting software sync
- Payment gateway integration

---

**Built with ❤️ using NestJS, Prisma, and TypeScript**
