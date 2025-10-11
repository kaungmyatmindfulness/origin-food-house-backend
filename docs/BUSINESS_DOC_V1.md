# Origin Food House - Business Documentation v1.0

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Business Overview](#business-overview)
3. [User Roles & Personas](#user-roles--personas)
4. [Core Business Workflows](#core-business-workflows)
5. [Feature Specifications](#feature-specifications)
6. [Business Rules & Constraints](#business-rules--constraints)
7. [Multi-Tenant Architecture](#multi-tenant-architecture)
8. [Use Cases & Scenarios](#use-cases--scenarios)
9. [Revenue & Pricing Models](#revenue--pricing-models)
10. [Future Roadmap](#future-roadmap)

---

## Executive Summary

**Origin Food House** is a comprehensive multi-tenant restaurant management system designed to streamline operations from menu management to payment processing. The platform enables restaurant owners to manage multiple locations, handle table-based dining sessions, process orders in real-time, and maintain complete control over their operations through role-based access.

### Key Value Propositions

- **Multi-Store Management**: Single platform for managing multiple restaurant locations
- **Real-Time Operations**: WebSocket-based live updates for cart and order management
- **Role-Based Access Control**: Granular permissions for different staff members
- **Flexible Menu Management**: Complex customization options and dynamic pricing
- **Customer Self-Service**: QR code-based table sessions for contactless ordering
- **Comprehensive Audit Trail**: Soft deletes and complete transaction history

---

## Business Overview

### Problem Statement

Restaurants face challenges in:
- Managing multiple locations efficiently
- Coordinating between front-of-house and kitchen staff
- Providing contactless ordering experiences
- Maintaining accurate inventory and pricing
- Tracking sales and performance across locations

### Solution

Origin Food House provides an integrated platform that:
1. **Centralizes operations** across multiple restaurant locations
2. **Enables contactless ordering** through table-based sessions
3. **Streamlines communication** between staff members
4. **Provides real-time updates** on orders and cart changes
5. **Maintains data integrity** through comprehensive validation

### Target Market

- **Quick-service restaurants** (QSR) with multiple locations
- **Full-service restaurants** requiring table management
- **Food courts** with multiple vendor management needs
- **Cloud kitchens** operating multiple brands from one location
- **Restaurant chains** seeking centralized management

---

## User Roles & Personas

### 1. Owner (Primary Stakeholder)

**Responsibilities:**
- Create and manage stores (restaurants)
- Assign roles to team members
- Update store information and settings
- Configure pricing, VAT, and service charges
- Full access to all store operations

**Typical Use Cases:**
- Setting up new restaurant locations
- Hiring and onboarding staff members
- Adjusting pricing strategies
- Reviewing sales reports
- Managing multiple locations

**Business Value:**
- Complete control over business operations
- Ability to scale to multiple locations
- Centralized management dashboard
- Role delegation for operational efficiency

### 2. Admin (Operations Manager)

**Responsibilities:**
- Manage menu items and categories
- Update store information
- Invite and assign roles to staff (except OWNER)
- Configure store settings
- Oversee daily operations

**Typical Use Cases:**
- Creating and updating menu items
- Managing seasonal menu changes
- Organizing categories and item ordering
- Updating store hours and contact information
- Coordinating with kitchen and service staff

**Business Value:**
- Operational autonomy without ownership transfer
- Menu management flexibility
- Staff coordination capabilities

### 3. Chef (Kitchen Staff)

**Responsibilities:**
- View active orders
- Update order item preparation status
- Monitor pending kitchen tasks
- Mark items as in-progress or completed

**Typical Use Cases:**
- Receiving new order notifications
- Tracking cooking queue
- Updating order status as items are prepared
- Coordinating with service staff

**Business Value:**
- Real-time order visibility
- Kitchen efficiency optimization
- Clear communication with front-of-house
- Preparation tracking

### 4. Cashier (Payment Processing)

**Responsibilities:**
- Create table sessions
- Process payments
- Generate bills
- View order history
- Handle customer requests for bills

**Typical Use Cases:**
- Opening new table sessions for arriving customers
- Calculating final bills with VAT and service charges
- Processing payment transactions
- Closing table sessions after payment
- Handling split bills

**Business Value:**
- Streamlined checkout process
- Accurate billing calculations
- Transaction record keeping
- Customer request management

### 5. Server (Front-of-House Staff)

**Responsibilities:**
- Create and manage table sessions
- Assist customers with ordering
- Handle customer service requests
- Monitor table status
- Communicate with kitchen

**Typical Use Cases:**
- Seating customers and creating sessions
- Helping customers navigate the menu
- Responding to service requests
- Delivering orders to tables
- Managing table turnover

**Business Value:**
- Enhanced customer service
- Efficient table management
- Order accuracy improvement
- Customer satisfaction

### 6. Customer (End User)

**Characteristics:**
- No authentication required
- Session-based access through table QR code
- Self-service ordering capability
- Real-time cart updates

**Journey:**
1. Scans QR code at table
2. Automatically joins table session
3. Browses menu with categories
4. Adds items with customizations
5. Views cart in real-time
6. Submits order
7. Requests bill when ready
8. Completes payment with staff

**Business Value:**
- Reduced wait times
- Order accuracy
- Contactless experience
- Self-paced ordering

---

## Core Business Workflows

### 1. Store Setup & Configuration

**Workflow Steps:**
1. Owner creates new store account
2. System generates unique store slug (URL identifier)
3. Owner configures store information:
   - Name, logo, cover photo
   - Address, phone, email, website
   - Currency selection
   - VAT rate (default 7%)
   - Service charge rate (default 0%)
4. System creates default store settings
5. Owner is automatically assigned OWNER role

**Business Rules:**
- Store slug must be unique across platform
- Currency cannot be changed after orders exist
- VAT and service charge are stored with each order (snapshot)

### 2. Staff Management

**Workflow Steps:**
1. Owner/Admin invites user by email
2. System validates email format
3. System checks if user exists in platform
4. If user doesn't exist, they must register first
5. Owner/Admin assigns appropriate role
6. System creates UserStore relationship
7. Staff member gains access to store

**Business Rules:**
- OWNER role cannot be assigned through invitation
- Admins can only assign CHEF, CASHIER, SERVER roles
- Users can belong to multiple stores with different roles
- Role changes take effect immediately

### 3. Menu Management

#### 3.1 Category Management

**Workflow Steps:**
1. Admin creates category with name
2. System assigns next sort order automatically
3. Admin can reorder categories
4. Category is immediately visible in menu
5. Admin can soft-delete categories (preserves history)

**Business Rules:**
- Category names must be unique within a store
- Deleted categories are not shown in public menu
- Menu items in deleted categories remain intact
- Sort order determines display sequence

#### 3.2 Menu Item Creation

**Workflow Steps:**
1. Admin creates menu item with:
   - Name and description
   - Base price (mandatory)
   - Category assignment
   - Optional image
   - Optional customization groups
2. System validates customization structure
3. System assigns sort order within category
4. Menu item becomes available immediately

**Business Rules:**
- Base price must be positive decimal
- Image URLs should be validated S3 URLs
- Customization groups can have min/max selections
- Each customization option can have additional price
- Items can be marked as hidden or out of stock

#### 3.3 Customization Groups

**Purpose:** Allow customers to personalize menu items

**Structure:**
- **Customization Group**: Size, Toppings, Spice Level, etc.
  - Name: Group identifier
  - minSelectable: Minimum required selections
  - maxSelectable: Maximum allowed selections
  - **Customization Options**: Multiple choices within group
    - Name: Option identifier
    - additionalPrice: Extra cost for this option

**Examples:**

```
Pizza Customization:
   Size (required, min=1, max=1)
       Small (+$0.00)
       Medium (+$2.00)
       Large (+$4.00)
   Toppings (optional, min=0, max=5)
       Extra Cheese (+$1.50)
       Pepperoni (+$2.00)
       Mushrooms (+$1.00)
       Olives (+$1.00)
   Crust (required, min=1, max=1)
       Thin Crust (+$0.00)
       Regular (+$0.00)
       Thick Crust (+$1.00)
```

**Business Rules:**
- Groups can be required (min e 1) or optional (min = 0)
- maxSelectable must be e minSelectable
- Options without additional price default to $0.00
- Customization constraints are validated during cart operations

### 4. Table Session Lifecycle

#### 4.1 Session Creation

**Actor:** Server, Cashier, or Customer (via QR code)

**Workflow Steps:**
1. Staff creates session for specific table, OR
2. Customer scans QR code at table
3. System checks if table already has active session:
   - If yes: Customer joins existing session
   - If no: System creates new session automatically
4. System generates session JWT token
5. System creates empty cart for session
6. System creates empty active order container
7. Customer receives session token for ordering

**Business Rules:**
- One active session per table at a time (enforced by unique constraint)
- Sessions are created immediately without approval
- JWT contains session ID (not user ID)
- Sessions remain open until manually closed or all orders paid

#### 4.2 Customer Ordering

**Workflow Steps:**
1. Customer authenticates with session JWT
2. Customer browses menu (public access)
3. Customer adds items to cart via WebSocket:
   - Selects menu item
   - Chooses required customizations
   - Adds optional customizations
   - Specifies quantity
   - Adds special notes
4. System validates customization constraints
5. System adds item to cart
6. System broadcasts cart update to all session participants
7. Customer reviews cart in real-time
8. Customer confirms cart to place order

**Business Rules:**
- Customization validation is mandatory
- Hidden or deleted menu items cannot be added
- Cart changes sync in real-time to all devices in session
- Multiple customers can share same session
- Cart persists until confirmed or session ends

#### 4.3 Order Processing

**Workflow Steps:**
1. Customer confirms cart
2. System validates cart is not empty
3. System converts cart items to order chunk
4. System adds chunk to active order
5. System deletes cart (fresh start for next order)
6. System broadcasts order update to kitchen
7. Chef receives order notification
8. Chef updates item status: PENDING � IN_PROGRESS � COMPLETED
9. Server delivers completed items

**Business Rules:**
- Empty carts cannot be confirmed
- Cart confirmation is atomic (all or nothing)
- Each confirmation creates one order chunk
- Multiple chunks can exist per session
- Order chunks are immutable once created
- Status updates are real-time

#### 4.4 Payment & Session Closure

**Workflow Steps:**
1. Customer requests bill (via app or to server)
2. Cashier/Server retrieves session order summary
3. System calculates totals:
   - Subtotal: Sum of all item prices � quantities
   - VAT Amount: Subtotal � VAT rate
   - Service Charge: Subtotal � Service charge rate
   - Grand Total: Subtotal + VAT + Service Charge
4. Cashier processes payment (external to system)
5. Cashier marks orders as paid
6. System creates Order record with:
   - All order items and customizations
   - Price snapshots (for historical accuracy)
   - VAT and service charge snapshots
   - Payment timestamp
7. System closes table session
8. System frees table for next customers

**Business Rules:**
- All order items must be completed before bill generation
- VAT and service charge rates are snapshotted per order
- Order records are immutable after creation
- Session closure is automatic after full payment
- Historical orders remain accessible for reporting

### 5. Customer Request Handling

**Request Types:**
- CALL_STAFF: Customer needs assistance
- REQUEST_BILL: Customer ready to pay

**Request Statuses:**
- PENDING: Newly created, awaiting staff attention
- RESOLVED: Completed by staff member

**Workflow Steps:**
1. Customer submits request via WebSocket
2. System creates customer request record with PENDING status
3. System notifies relevant staff members
4. Staff views pending requests filtered by status
5. Staff responds to customer
6. Staff marks request as RESOLVED
7. System updates request status and timestamp

**Business Rules:**
- Multiple requests can be active simultaneously
- Requests are associated with specific table session
- Staff can filter by request type (CALL_STAFF, REQUEST_BILL) and status (PENDING, RESOLVED)
- Resolved requests remain in history with timestamp
- Status transitions only allowed from PENDING to RESOLVED (no reversal)

---

## Feature Specifications

### 1. Multi-Store Management

**Capability:** Manage multiple restaurant locations from single account

**Features:**
- Unique store slug for each location
- Separate menu per store
- Independent staff assignments
- Store-specific settings and branding
- Cross-store reporting (future)

**Technical Implementation:**
- Every entity scoped to storeId
- Data isolation enforced at service layer
- Store membership required for access
- Role-based permissions per store

### 2. Real-Time Cart Synchronization

**Capability:** Live updates of cart changes across all devices in session

**Features:**
- WebSocket-based communication
- Instant cart updates
- Shared session cart
- Conflict resolution
- Optimistic UI updates

**Technical Implementation:**
- Socket.IO gateways
- Event-driven architecture
- Session-based rooms
- Automatic reconnection
- State synchronization

### 3. Complex Menu Customization

**Capability:** Support intricate menu item variations and options

**Features:**
- Nested customization groups
- Min/max selection constraints
- Dynamic pricing calculations
- Option validation
- Customization templates

**Technical Implementation:**
- Hierarchical data structure
- Validation rules engine
- Price aggregation logic
- Upsert-based synchronization

### 4. Image Management

**Capability:** Upload and manage menu item images

**Features:**
- S3-based storage
- Image optimization
- Automatic cleanup
- CDN delivery
- Usage tracking

**Technical Implementation:**
- AWS S3 integration
- Sharp image processing
- Weekly cleanup job
- Database reference tracking
- Orphan detection

### 5. Soft Delete Pattern

**Capability:** Preserve historical data while hiding deleted entities

**Features:**
- Non-destructive deletion
- Audit trail maintenance
- Historical reporting
- Data recovery
- Referential integrity

**Technical Implementation:**
- deletedAt timestamp field
- Query filters on all reads
- Cascade relationships
- Unique constraints with deletedAt
- Archive access for reporting

---

## Business Rules & Constraints

### Store-Level Rules

1. **Store Slug Uniqueness**
   - Format: `{slugified-name}-{6-char-nanoid}`
   - Example: `downtown-bistro-a1b2c3`
   - Purpose: Human-readable URLs and store identification

2. **Currency Immutability**
   - Currency set during store creation
   - Cannot be changed after first order
   - Prevents financial data inconsistency

3. **Settings Snapshots**
   - VAT and service charge rates stored with each order
   - Allows historical rate changes without affecting past orders
   - Ensures accurate financial reporting

### Menu Management Rules

1. **Category Sort Order**
   - Automatically assigned incrementally
   - Determines menu display sequence
   - Can be manually reordered by admin

2. **Menu Item Visibility**
   - `isHidden=true`: Staff can see, customers cannot
   - `isOutOfStock=true`: Visible but cannot be ordered
   - `deletedAt != null`: Not visible to anyone (except reports)

3. **Customization Validation**
   - Required groups: Customer must select min count
   - Optional groups: Customer can skip
   - Max selections: System enforces upper limit
   - Invalid options: Request rejected

### Session Management Rules

1. **One Session Per Table**
   - Enforced by database unique constraint
   - New session attempt joins existing session
   - Prevents double-booking confusion

2. **Session Closure Triggers**
   - Manual closure by staff
   - Automatic closure after full payment
   - Manual emergency closure by admin

3. **Cart Lifecycle**
   - Created with session
   - Cleared upon order confirmation
   - Recreated for next order
   - Deleted with session closure

### Order Processing Rules

1. **Order Immutability**
   - Order chunks cannot be edited after creation
   - Prevents accidental order changes
   - Maintains kitchen workflow integrity

2. **Status Progression**
   - PENDING: Just received
   - IN_PROGRESS: Chef cooking
   - COMPLETED: Ready to serve
   - No backward transitions allowed

3. **Price Locking**
   - Menu item price captured at order time
   - Customization prices captured at order time
   - Future price changes don't affect active orders

### Payment & Billing Rules

1. **Bill Calculation**
   ```
   Subtotal = �(item.basePrice + �(option.additionalPrice)) � quantity
   VAT Amount = Subtotal � vatRate
   Service Charge = Subtotal � serviceChargeRate
   Grand Total = Subtotal + VAT Amount + Service Charge
   ```

2. **Payment Recording**
   - Payment marked with timestamp
   - All item details captured in Order table
   - Historical rates preserved
   - Cannot be modified after recording

3. **Session Closure Conditions**
   - All order chunks must be completed
   - Payment must be recorded
   - No pending customer requests (optional)
   - Manual confirmation by staff

### Security & Access Rules

1. **Role Hierarchy**
   - OWNER: Full access to store
   - ADMIN: Operations and staff management
   - CHEF: Order viewing and status updates
   - CASHIER: Session and payment management
   - SERVER: Session and service management

2. **Store Permission Checks**
   - Every mutation validates user store membership
   - Role requirements enforced per endpoint
   - Store data isolation maintained
   - Cross-store access prevented

3. **Customer Session Security**
   - JWT contains only session ID
   - No user identity exposed
   - Session expires on closure
   - Cannot access other sessions

---

## Multi-Tenant Architecture

### Tenant Isolation Strategy

**Store as Tenant Unit:**
- Each restaurant location is a separate tenant
- Data scoped to storeId at database level
- Service layer enforces isolation
- No cross-tenant data leakage

**Benefits:**
- Single database deployment
- Simplified infrastructure
- Cost efficiency
- Centralized management
- Easy backup and recovery

**Implementation:**
- Every query includes `where: { storeId }`
- Middleware validates store context
- API routes include storeId parameter
- JWT tokens include storeId claim

### Data Partitioning

**Tenant-Specific Data:**
- Menu items and categories
- Tables and sessions
- Orders and order items
- Store information and settings

**Shared Data:**
- User accounts
- Authentication records
- System configuration

**Cross-Tenant Relationships:**
- Users can belong to multiple stores
- UserStore junction table with roles
- User authentication separate from store access

---

## Use Cases & Scenarios

### Scenario 1: Opening a New Restaurant Location

**Actors:** Owner, Admin

**Flow:**
1. Owner logs into platform
2. Owner creates new store: "Downtown Bistro - Location 2"
3. System generates slug: `downtown-bistro-loc2-x7y8z9`
4. Owner configures store details and settings
5. Owner invites manager as ADMIN
6. Admin sets up menu by importing from location 1
7. Admin customizes menu for local preferences
8. Admin creates table records for new location
9. System generates QR codes for each table
10. Restaurant is ready for customers

**Success Criteria:**
- Store created with unique identity
- Menu configured and accessible
- Staff assigned with correct roles
- Tables ready with QR codes
- System operational for customer orders

### Scenario 2: Lunch Rush Hour Operations

**Actors:** Server, Customer, Chef, Cashier

**Flow:**
1. **12:00 PM** - Customers arrive, server creates table sessions
2. **12:05 PM** - Customers scan QR codes, browse menu
3. **12:08 PM** - Customers add items with customizations to cart
4. **12:10 PM** - Customers confirm orders
5. **12:11 PM** - Chef receives order notification in kitchen
6. **12:15 PM** - Chef marks items as IN_PROGRESS
7. **12:25 PM** - Chef marks items as COMPLETED
8. **12:26 PM** - Server delivers food to tables
9. **12:40 PM** - Customers request bill
10. **12:42 PM** - Cashier generates bill, processes payment
11. **12:43 PM** - System closes session, frees table

**Success Criteria:**
- Multiple concurrent sessions handled smoothly
- Real-time order flow to kitchen
- Accurate billing calculations
- Quick table turnover
- No order errors or delays

### Scenario 3: Menu Update Mid-Service

**Actors:** Admin, Customer, Chef

**Flow:**
1. **2:00 PM** - Admin notices "Grilled Salmon" is out of stock
2. Admin marks menu item as `isOutOfStock = true`
3. Existing carts with salmon remain valid (customer already selected)
4. New customers cannot add salmon to cart
5. Kitchen completes existing salmon orders
6. **4:00 PM** - New stock arrives
7. Admin marks `isOutOfStock = false`
8. Menu item immediately available again

**Success Criteria:**
- Stock status updates in real-time
- Existing orders not affected
- New orders reflect current availability
- No customer confusion
- Kitchen workflow uninterrupted

### Scenario 4: Handling Special Dietary Requirements

**Actors:** Customer, Server

**Flow:**
1. Customer browses menu, has nut allergy
2. Customer adds item to cart
3. In customization options, selects "No Nuts"
4. Customer adds note: "Severe nut allergy - please ensure no cross-contamination"
5. Customer confirms order
6. Kitchen receives order with prominent allergy note
7. Chef prepares with extra precautions
8. Server delivers with confirmation of allergy handling

**Success Criteria:**
- Customization options support dietary needs
- Notes visible to kitchen staff
- Special handling communicated clearly
- Customer safety ensured
- Order accuracy maintained

### Scenario 5: Split Bill Payment

**Actors:** Customers (group), Cashier

**Current Implementation:**
- Single payment per session
- Manual split bill calculation by cashier
- Full payment records in system

**Future Enhancement:**
- Per-customer cart tracking
- Individual payment processing
- Automated split bill calculations
- Partial payment support

---

## Revenue & Pricing Models

### Platform Revenue Model

*Note: This section is for future commercialization*

**Potential Models:**
1. **Subscription-Based:**
   - Monthly fee per store location
   - Tiered plans based on features
   - Transaction limits per tier

2. **Transaction-Based:**
   - Small percentage per order
   - Volume discounts for high-traffic stores
   - No monthly fixed costs

3. **Freemium:**
   - Basic features free
   - Premium features (analytics, integrations) paid
   - Self-service vs. enterprise support

### Store Pricing Flexibility

**Current Capabilities:**
- Store sets own menu prices
- Dynamic customization pricing
- VAT and service charge configuration
- Currency selection per store

**Future Enhancements:**
- Time-based pricing (happy hour)
- Promotional discounts
- Loyalty programs
- Dynamic pricing based on demand

---

## Future Roadmap

### Phase 2: Enhanced Operations (Q2 2025)

**Features:**
- Kitchen display system (KDS) integration
- Table occupancy analytics
- Staff performance tracking
- Inventory management basics
- Mobile app for staff

**Business Value:**
- Improved kitchen efficiency
- Better resource allocation
- Performance insights
- Cost control
- Staff mobility

### Phase 3: Customer Experience (Q3 2025)

**Features:**
- Customer accounts and profiles
- Order history and favorites
- Loyalty points program
- Reservations system
- Customer feedback collection

**Business Value:**
- Increased repeat business
- Personalized experiences
- Customer retention
- Valuable feedback data
- Booking optimization

### Phase 4: Advanced Analytics (Q4 2025)

**Features:**
- Sales reporting dashboard
- Menu item performance analysis
- Peak hours identification
- Staff efficiency metrics
- Financial projections

**Business Value:**
- Data-driven decisions
- Revenue optimization
- Operational insights
- Performance benchmarking
- Strategic planning

### Phase 5: Ecosystem Integration (Q1 2026)

**Features:**
- POS system integration
- Third-party delivery platforms
- Accounting software sync
- Marketing automation
- Payment gateway integration

**Business Value:**
- Seamless workflows
- Expanded reach
- Financial accuracy
- Marketing efficiency
- Payment flexibility

---

## Glossary

**Active Order:** Container for all order chunks within a table session

**Active Order Chunk:** Single confirmed cart submission, group of items

**Cart:** Temporary shopping basket for current order before confirmation

**Customization Group:** Category of options (Size, Toppings, etc.)

**Customization Option:** Specific choice within a group (Small, Large, etc.)

**Order:** Final paid record with all items and pricing snapshots

**Session:** Period from customer seating to payment and departure

**Soft Delete:** Marking record as deleted without physical removal

**Store:** Single restaurant location or tenant in multi-tenant system

**Table Session:** Active session associated with specific physical table

---

**Document Version:** 1.1
**Last Updated:** 2025-10-11
**Maintained By:** Development Team
**Next Review:** Q1 2026
