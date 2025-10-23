# Release Slice A Gap Analysis

**Date**: 2025-01-23
**Analyst**: Sprint Orchestrator (BA/PO Function)
**Scope**: Core Operations (Release Slice A)
**Project**: Origin Food House - Multi-tenant Restaurant Management Platform

---

## Executive Summary

**Overall Slice A Status**: **75% Complete** (Partially Implemented)

**Key Findings**:
- Core backend architecture is solid with 257 passing tests and 85%+ coverage on critical modules
- Most backend API endpoints exist and are functional
- **CRITICAL GAPS** identified in frontend implementations (both RMS and SOS)
- **MISSING FEATURES**: Bill splitting, table state management, QR code generation UI, discount management, void/refund reason codes
- **GOOD NEWS**: Cart, Order, Payment, Kitchen, Menu, and Table modules are well-implemented on backend

**Estimated Work Remaining**:
- Backend: 10% (minor enhancements)
- Frontend RMS: 40% (significant UI work needed)
- Frontend SOS: 20% (checkout and payment features)
- Total: ~15-20 developer days

---

## Feature Status Matrix

| Feature Area | Sub-Feature | Backend Status | Frontend Status | Priority | Blocker |
|--------------|-------------|----------------|-----------------|----------|---------|
| **RMS (Sales)** | | | | | |
| | Create checks by table | ✅ Complete | ⚠️ Partial (via sessions) | HIGH | No |
| | Create checks by counter | ❌ Missing | ❌ Missing | MEDIUM | No |
| | View checks | ✅ Complete | ⚠️ Partial | HIGH | No |
| | Close checks | ✅ Complete (via sessions) | ⚠️ Partial | HIGH | No |
| | Add items to checks | ✅ Complete | ✅ Complete | CRITICAL | No |
| | Apply discounts | ❌ Missing | ❌ Missing | MEDIUM | No |
| | Split bills | ❌ Missing | ❌ Missing | HIGH | No |
| | Record payments | ✅ Complete | ⚠️ Partial | CRITICAL | No |
| | Issue refunds | ✅ Complete (API) | ❌ Missing (UI) | HIGH | No |
| | Voids with reason codes | ⚠️ Partial (no void status) | ❌ Missing | MEDIUM | No |
| **Tables** | | | | | |
| | Define table names | ✅ Complete | ✅ Complete | CRITICAL | No |
| | Floor areas | ❌ Missing | ❌ Missing | LOW | No |
| | Monitor table states | ⚠️ Partial (sessions only) | ⚠️ Partial | HIGH | No |
| | Table state transitions | ❌ Missing | ❌ Missing | HIGH | No |
| | Combine tables | ❌ Missing | ❌ Missing | MEDIUM | No |
| | Transfer tables | ❌ Missing | ❌ Missing | MEDIUM | No |
| **Menu Management** | | | | | |
| | Create categories | ✅ Complete | ✅ Complete | CRITICAL | No |
| | Create menu items | ✅ Complete | ✅ Complete | CRITICAL | No |
| | Customizations | ✅ Complete | ✅ Complete | CRITICAL | No |
| | Prices, descriptions | ✅ Complete | ✅ Complete | CRITICAL | No |
| | Preparation times | ❌ Missing | ❌ Missing | MEDIUM | No |
| | "86" unavailable dishes | ⚠️ Partial (isOutOfStock) | ⚠️ Partial | MEDIUM | No |
| | Visibility control | ✅ Complete (isHidden) | ✅ Complete | HIGH | No |
| **QR Codes** | | | | | |
| | Static QR generation | ✅ Complete (Table entity) | ❌ Missing (UI) | CRITICAL | Yes |
| | QR contains {storeId, tableId} | ✅ Complete | N/A | CRITICAL | No |
| | Guest scan and join | ✅ Complete | ✅ Complete | CRITICAL | No |
| | Join active check | ✅ Complete | ✅ Complete | CRITICAL | No |
| | Create new check | ✅ Complete | ✅ Complete | CRITICAL | No |
| **KDS Basic** | | | | | |
| | Orders by routing area | ❌ Missing (no routing) | ❌ Missing | HIGH | Yes |
| | Order state tracking | ✅ Complete | ✅ Complete | CRITICAL | No |
| | Color indicators for delays | ❌ Missing | ❌ Missing | MEDIUM | No |
| | OWNER/ADMIN view all | ✅ Complete (RBAC) | ✅ Complete | HIGH | No |
| **Payment Recording** | | | | | |
| | Review bill | ✅ Complete | ⚠️ Partial | CRITICAL | No |
| | Record payment type | ✅ Complete | ⚠️ Partial | CRITICAL | No |
| | Calculate change | ❌ Missing | ❌ Missing | HIGH | No |
| | Payment summary | ✅ Complete | ❌ Missing (UI) | HIGH | No |
| **Reports** | | | | | |
| | Sales summaries | ✅ Complete | ❌ Missing (UI) | HIGH | No |
| | Top-selling items | ✅ Complete | ❌ Missing (UI) | HIGH | No |
| | Payment breakdown | ✅ Complete | ❌ Missing (UI) | MEDIUM | No |
| | Staff activity | ❌ Missing | ❌ Missing | MEDIUM | No |
| | CSV export | ❌ Missing | ❌ Missing | MEDIUM | No |

---

## Detailed Gap Analysis

### 1. RMS (Point of Sale)

**Overall Status**: ⚠️ **Partially Implemented** (Backend 80%, Frontend 40%)

#### 1.1 Check Management

**Requirement** (from BRD):
> Staff can create, view, and close checks by table or counter. Add items, apply discounts, split bills, and record payments.

**Current Implementation**:
- **Backend**:
  - ✅ Orders can be created via checkout from cart (session-based)
  - ✅ Orders can be viewed by store with pagination (`GET /orders?storeId=X`)
  - ✅ Orders have status tracking (PENDING → PREPARING → READY → SERVED → COMPLETED → CANCELLED)
  - ✅ OrderModule has 98% test coverage (78 tests passing)
- **Frontend RMS**:
  - ⚠️ Sale page exists at `/hub/sale` but implementation unclear
  - ❌ No dedicated "create check by table" UI (relies on customer QR flow)
  - ❌ No "create check by counter" UI (for takeout/phone orders)
  - ❌ No check management dashboard

**Gap**:
- ❌ **Counter/Takeout Orders**: No way for staff to create orders directly without customer initiating via QR
- ❌ **Check Dashboard**: Missing UI to view all active checks in RMS
- ❌ **Manual Order Creation**: Staff cannot manually add items for phone orders or walk-ins

**Priority**: **HIGH** (Core POS functionality)

**Acceptance Criteria**:
- [ ] Staff can create a new check from RMS without QR code
- [ ] Staff can select table OR mark as counter/takeout
- [ ] All active checks visible in a dashboard view
- [ ] Checks can be manually closed by staff

---

#### 1.2 Discounts

**Requirement** (from BRD):
> Apply discounts [to checks]

**Current Implementation**:
- **Backend**: ❌ No discount model, no discount logic in Order or Payment modules
- **Frontend**: ❌ No discount UI in either RMS or SOS

**Gap**:
- ❌ **Discount Model**: No Prisma schema entity for discounts
- ❌ **Discount Types**: No concept of percentage vs. fixed amount discounts
- ❌ **Discount Application**: No endpoint to apply discount to order
- ❌ **Discount Tracking**: No audit trail for who applied what discount

**Priority**: **MEDIUM** (Nice-to-have for MVP, critical for production)

**Acceptance Criteria**:
- [ ] Create Discount Prisma model (type, amount/percentage, orderId, appliedBy)
- [ ] POST /orders/:orderId/discounts endpoint
- [ ] Discount reflected in order grandTotal calculation
- [ ] RMS UI to apply discount with reason and amount

---

#### 1.3 Split Bills

**Requirement** (from BRD):
> Split bills [among diners]

**Current Implementation**:
- **Backend**: ❌ No bill splitting logic
- **Frontend**: ❌ No bill splitting UI

**Gap**:
- ❌ **Split Logic**: No way to divide order items or amounts across multiple payments
- ❌ **Partial Payments**: Payment model supports single payment per order (no split tracking)
- ❌ **Split UI**: No customer or staff interface for splitting

**Priority**: **HIGH** (Common restaurant use case)

**Acceptance Criteria**:
- [ ] Order can have multiple partial payments
- [ ] Staff can split order equally (N ways) or by item
- [ ] Each diner gets their portion of bill
- [ ] Payment summary shows split breakdown

**Note**: This requires significant backend refactoring. Currently, `Payment.amount` is tracked, but there's no concept of "who owes what" or "split allocations."

---

#### 1.4 Refunds and Voids

**Requirement** (from BRD):
> Issue refunds or voids with reason codes (recorded in audit logs)

**Current Implementation**:
- **Backend**:
  - ✅ Refund model exists with `amount`, `reason`, `refundedBy`
  - ✅ POST /payments/orders/:orderId/refunds endpoint
  - ✅ Refunds have reason field
  - ⚠️ No concept of "void" (order cancellation before payment is different from refund)
- **Frontend**:
  - ❌ No refund UI in RMS
  - ❌ No void UI (cancel order)

**Gap**:
- ⚠️ **Void vs. Refund**: No distinction between cancelling unpaid order (void) vs. refunding paid order
- ❌ **Void Status**: Order status CANCELLED exists but no workflow to cancel with reason
- ❌ **Refund UI**: Staff cannot issue refunds from RMS interface
- ❌ **Audit Logging**: Refunds/voids not logged to separate audit system

**Priority**: **HIGH** (Required for order corrections)

**Acceptance Criteria**:
- [ ] PATCH /orders/:orderId/cancel endpoint with reason
- [ ] RMS UI for cancelling orders (with reason dropdown)
- [ ] RMS UI for issuing refunds (with reason and amount)
- [ ] Audit log entries for all cancellations and refunds

---

### 2. Tables

**Overall Status**: ⚠️ **Partially Implemented** (Backend 70%, Frontend 60%)

#### 2.1 Table State Management

**Requirement** (from BRD):
> Monitor table states: Vacant → Seated → Ordering → Served → Ready to Pay → Cleaning

**Current Implementation**:
- **Backend**:
  - ✅ Table entity exists with CRUD operations
  - ✅ ActiveTableSession entity tracks session status (ACTIVE/CLOSED)
  - ❌ No explicit table state enum (Vacant, Seated, Ordering, etc.)
  - ❌ Table state must be inferred from ActiveTableSession status
- **Frontend**:
  - ✅ RMS has tables page at `/hub/(owner-admin)/tables`
  - ⚠️ Table state display unclear (need to review implementation)

**Gap**:
- ❌ **Table State Enum**: No explicit state tracking beyond session status
- ❌ **State Transitions**: No enforced workflow (Vacant → Seated → Ordering → Served → Ready to Pay → Cleaning)
- ❌ **Cleaning State**: No way to mark table as "needs cleaning"
- ❌ **Visual Indicators**: No color-coded table status dashboard

**Priority**: **HIGH** (Critical for floor management)

**Acceptance Criteria**:
- [ ] Add TableStatus enum to Prisma schema (VACANT, SEATED, ORDERING, SERVED, READY_TO_PAY, CLEANING)
- [ ] Add `currentStatus` field to Table model
- [ ] PATCH /tables/:id/status endpoint with state transition validation
- [ ] RMS table dashboard with color-coded status
- [ ] Automatic state transitions based on session/order events

---

#### 2.2 Floor Areas

**Requirement** (from BRD):
> Define floor areas and table names

**Current Implementation**:
- **Backend**:
  - ✅ Table entity has `name` field
  - ❌ No `floorArea` or `section` field
- **Frontend**:
  - ✅ Table names can be set

**Gap**:
- ❌ **Floor Area Field**: No way to group tables by section (e.g., "Patio", "Main Dining", "Bar")
- ❌ **Floor Area Filter**: No way to filter tables by area in RMS

**Priority**: **LOW** (Nice-to-have for larger restaurants)

**Acceptance Criteria**:
- [ ] Add `floorArea` string field to Table model
- [ ] RMS UI to assign floor area when creating table
- [ ] RMS table dashboard can filter by floor area

---

#### 2.3 Combine and Transfer Tables

**Requirement** (from BRD):
> Combine or transfer tables when needed

**Current Implementation**:
- **Backend**: ❌ No logic for combining sessions or transferring orders
- **Frontend**: ❌ No UI for table operations

**Gap**:
- ❌ **Combine Tables**: No way to merge two active sessions into one
- ❌ **Transfer Table**: No way to move session/order from one table to another
- ❌ **Order Reassignment**: OrderItem doesn't support reassigning to different order

**Priority**: **MEDIUM** (Edge case, but useful for busy restaurants)

**Acceptance Criteria**:
- [ ] POST /active-table-sessions/:id/combine endpoint
- [ ] POST /active-table-sessions/:id/transfer endpoint
- [ ] RMS UI for combining tables (merges carts and orders)
- [ ] RMS UI for transferring to different table

---

### 3. Menu Management

**Overall Status**: ✅ **Mostly Complete** (Backend 95%, Frontend 90%)

#### 3.1 Core Menu Features

**Current Implementation**:
- **Backend**:
  - ✅ Category CRUD with sorting (85% test coverage)
  - ✅ MenuItem CRUD with pricing, descriptions, images
  - ✅ CustomizationGroup and CustomizationOption fully implemented
  - ✅ Soft deletes on Category and MenuItem
  - ✅ Store-scoped queries
- **Frontend**:
  - ✅ RMS has menu management at `/hub/(owner-admin)/menu`
  - ✅ SOS displays menu for customers at `/restaurants/[slug]/menu`
  - ✅ Customizations work in both RMS and SOS

**Gap**: ⚠️ Minor features missing

---

#### 3.2 Preparation Times

**Requirement** (from BRD):
> Configure preparation times [for menu items]

**Current Implementation**:
- **Backend**: ❌ No `preparationTimeMinutes` field on MenuItem
- **Frontend**: ❌ No UI to set preparation time

**Gap**:
- ❌ **Preparation Time Field**: Not in schema
- ❌ **KDS Estimation**: Cannot show estimated ready time on KDS

**Priority**: **MEDIUM** (Useful for KDS and customer expectations)

**Acceptance Criteria**:
- [ ] Add `preparationTimeMinutes` Int? field to MenuItem model
- [ ] RMS menu form includes preparation time input
- [ ] KDS displays estimated ready time based on prep times

---

#### 3.3 "86" Unavailable Dishes

**Requirement** (from BRD):
> Temporarily hide or "86" unavailable dishes manually

**Current Implementation**:
- **Backend**:
  - ✅ MenuItem has `isOutOfStock` boolean field
  - ✅ MenuItem has `isHidden` boolean field
- **Frontend**:
  - ⚠️ Unclear if RMS has UI to toggle isOutOfStock quickly

**Gap**:
- ⚠️ **Quick Toggle**: Need easy way for staff to mark items as 86'd (out of stock)
- ⚠️ **Automatic Hiding**: isOutOfStock items should auto-hide from customer menu

**Priority**: **MEDIUM** (Operational convenience)

**Acceptance Criteria**:
- [ ] RMS menu page has quick "86" toggle button per item
- [ ] PATCH /menu/:id endpoint to update isOutOfStock
- [ ] SOS menu auto-filters isOutOfStock items
- [ ] KDS shows which items are 86'd

---

### 4. QR Codes

**Overall Status**: ⚠️ **Backend Complete, Frontend Missing** (Backend 100%, Frontend 30%)

#### 4.1 QR Code Generation

**Requirement** (from BRD):
> Static QR (contains {storeId, tableId}). Guest scans and joins/creates session.

**Current Implementation**:
- **Backend**:
  - ✅ Table entity has storeId and tableId (id)
  - ✅ POST /active-table-sessions/join-by-table/:tableId endpoint works
  - ✅ Session creation logic fully functional
- **Frontend SOS**:
  - ✅ Scan QR and join session works (route: `/tables/[id]/join`)
- **Frontend RMS**:
  - ❌ No QR code generation UI for tables
  - ❌ No way to download/print QR codes

**Gap**:
- ❌ **QR Code Generation**: RMS has no UI to generate QR codes for tables
- ❌ **QR Code Format**: No standardized QR code content format (should encode URL: `https://sos.app/tables/{tableId}/join`)
- ❌ **Print/Download**: No way to bulk generate and print QR codes for all tables

**Priority**: **CRITICAL** (Blocker for table-based ordering)

**Acceptance Criteria**:
- [ ] RMS tables page shows QR code for each table
- [ ] QR code encodes URL: `{SOS_URL}/tables/{tableId}/join`
- [ ] RMS has "Download QR" button per table (PNG/PDF)
- [ ] RMS has "Print All QR Codes" button for batch printing
- [ ] QR codes include table name and store name for clarity

---

### 5. Kitchen Display System (KDS)

**Overall Status**: ⚠️ **Partially Implemented** (Backend 60%, Frontend 60%)

#### 5.1 Routing Areas (Preparation Stations)

**Requirement** (from BRD):
> Orders appear automatically by routing area (e.g., Grill, Drinks)

**Current Implementation**:
- **Backend**:
  - ❌ No RoutingArea or PreparationStation concept in schema
  - ❌ MenuItem does not have `routingArea` field
  - ✅ KDS endpoint exists: GET /kitchen/orders?storeId=X
- **Frontend**:
  - ✅ KDS page exists at `/hub/(chef)/kitchen`
  - ❌ No filtering by routing area

**Gap**:
- ❌ **Routing Area Model**: No way to categorize menu items by station (Grill, Fry, Salad, Drinks, Dessert)
- ❌ **Station Filtering**: KDS cannot filter orders by station
- ❌ **Order Routing**: Orders not automatically routed to specific stations

**Priority**: **HIGH** (Blocker for efficient kitchen operations)

**Acceptance Criteria**:
- [ ] Add RoutingArea enum to Prisma (GRILL, FRY, SALAD, DRINKS, DESSERT, OTHER)
- [ ] Add `routingArea` field to MenuItem model
- [ ] KDS endpoint supports filtering: GET /kitchen/orders?storeId=X&routingArea=GRILL
- [ ] KDS frontend has station tabs (All, Grill, Fry, Salad, etc.)
- [ ] Orders automatically routed to correct station based on items

---

#### 5.2 Order State Tracking

**Requirement** (from BRD):
> Track states: Queued → Firing → Ready → Served

**Current Implementation**:
- **Backend**:
  - ✅ OrderStatus enum: PENDING, PREPARING, READY, SERVED, COMPLETED, CANCELLED
  - ✅ PATCH /kitchen/orders/:id/status endpoint
- **Frontend**:
  - ✅ KDS shows order status
  - ⚠️ State transition buttons unclear

**Gap**:
- ⚠️ **"Firing" State**: Current statuses map roughly to requirements but "Firing" is not explicit
  - Queued ≈ PENDING
  - Firing ≈ PREPARING
  - Ready ≈ READY
  - Served ≈ SERVED
- ⚠️ **State Transition Enforcement**: No validation that states follow correct sequence

**Priority**: **MEDIUM** (Current states are adequate, but naming could be clearer)

**Acceptance Criteria**:
- [ ] Document state mapping in KDS module
- [ ] Add state transition validation (PENDING → PREPARING → READY → SERVED)
- [ ] KDS buttons clearly labeled ("Start Cooking", "Mark Ready", "Mark Served")

---

#### 5.3 Color Indicators for Delays

**Requirement** (from BRD):
> Color indicators for preparation delays (based on SLA timers)

**Current Implementation**:
- **Backend**: ❌ No SLA timer, no delay calculation
- **Frontend**: ❌ No color-coded order cards

**Gap**:
- ❌ **SLA Timers**: No concept of expected preparation time
- ❌ **Delay Calculation**: No logic to compare elapsed time vs. expected time
- ❌ **Visual Indicators**: KDS orders not color-coded (e.g., green = on time, yellow = approaching SLA, red = overdue)

**Priority**: **MEDIUM** (Nice-to-have for production)

**Acceptance Criteria**:
- [ ] Add `preparationTimeMinutes` to MenuItem (see Menu section)
- [ ] KDS calculates elapsed time since order placed
- [ ] KDS color codes orders:
  - Green: < 75% of expected time
  - Yellow: 75-100% of expected time
  - Red: > 100% of expected time
- [ ] KDS displays elapsed time on each order card

---

### 6. Payment Recording

**Overall Status**: ⚠️ **Backend Complete, Frontend Partial** (Backend 100%, Frontend 50%)

#### 6.1 Payment Recording

**Requirement** (from BRD):
> Guests or servers review the bill and record payment type (cash, card, or mobile). The app records tender details and calculates change when applicable.

**Current Implementation**:
- **Backend**:
  - ✅ Payment model with amount, paymentMethod, notes
  - ✅ POST /payments/orders/:orderId endpoint
  - ✅ Payment methods: CASH, CREDIT_CARD, DEBIT_CARD, MOBILE_PAYMENT, OTHER
  - ✅ Payment summary endpoint: GET /payments/orders/:orderId/summary
- **Frontend RMS**:
  - ⚠️ Payment recording UI unclear (need to review sale page)
- **Frontend SOS**:
  - ⚠️ Checkout flow exists but payment recording unclear

**Gap**:
- ❌ **Change Calculation**: No logic to calculate change (amountTendered - grandTotal)
- ❌ **Cash Handling**: Payment model doesn't have `amountTendered` field for cash payments
- ❌ **Payment UI**: RMS needs clear payment recording interface

**Priority**: **HIGH** (Core POS functionality)

**Acceptance Criteria**:
- [ ] Add `amountTendered` Decimal? field to Payment model (for cash)
- [ ] Payment service calculates `change = amountTendered - grandTotal` for cash
- [ ] RMS payment UI shows:
  - Grand total
  - Payment method selector
  - Amount tendered input (cash only)
  - Calculated change display
- [ ] SOS checkout shows payment summary before confirmation

---

### 7. Reports

**Overall Status**: ⚠️ **Backend Complete, Frontend Missing** (Backend 100%, Frontend 0%)

#### 7.1 Reports Backend

**Current Implementation**:
- **Backend**:
  - ✅ ReportService with 4 report types:
    1. Sales summary: GET /reports/sales-summary
    2. Payment breakdown: GET /reports/payment-breakdown
    3. Popular items: GET /reports/popular-items
    4. Order status: GET /reports/order-status
  - ✅ All reports accept date range (startDate, endDate)
  - ✅ RBAC enforced (OWNER/ADMIN only)
- **Frontend**:
  - ❌ No reports page in RMS
  - ❌ No report visualization

**Gap**:
- ❌ **Reports UI**: RMS has no reports/analytics page
- ❌ **Date Range Picker**: No UI for selecting report date range
- ❌ **Staff Activity Report**: Backend missing (BRD requirement)
- ❌ **CSV Export**: No export functionality

**Priority**: **HIGH** (Critical for business insights)

**Acceptance Criteria**:
- [ ] RMS reports page at `/hub/(owner-admin)/reports`
- [ ] Report cards for: Sales Summary, Top Items, Payment Breakdown, Order Status
- [ ] Date range picker (Today, This Week, This Month, Custom)
- [ ] Staff activity report backend endpoint: GET /reports/staff-activity
- [ ] CSV export button on each report
- [ ] Charts/graphs for visual insights (optional but nice-to-have)

---

## Summary by Priority

### CRITICAL (Blockers - Must Implement)

**Backend**:
- None (all critical backend features exist)

**Frontend**:
1. **QR Code Generation UI** (RMS): Cannot deploy table ordering without QR codes
   - Location: `/hub/(owner-admin)/tables`
   - Required: QR code display, download, print functionality

**Estimated Effort**: 2 developer days

---

### HIGH (Core Functionality - Should Implement for MVP)

**Backend**:
1. **Routing Areas for KDS** (MenuItem.routingArea field)
   - Add RoutingArea enum to schema
   - Add field to MenuItem model
   - Update KDS endpoint to filter by routing area
   - **Estimated**: 1 developer day

2. **Change Calculation for Cash Payments** (Payment.amountTendered field)
   - Add field to Payment model
   - Update payment service to calculate change
   - **Estimated**: 0.5 developer days

3. **Table State Management** (Table.currentStatus field)
   - Add TableStatus enum
   - Add state transition logic
   - **Estimated**: 1 developer day

**Frontend**:
1. **RMS Manual Order Creation** (Create check without QR)
   - Location: `/hub/sale` (enhance existing page)
   - Features: Select table/counter, add items, create order
   - **Estimated**: 3 developer days

2. **Bill Splitting** (RMS and SOS)
   - Backend: Support multiple partial payments per order
   - Frontend: Split bill UI (by amount or by item)
   - **Estimated**: 3 developer days

3. **Payment Recording UI** (RMS)
   - Location: `/hub/sale` or dedicated payment modal
   - Features: Select payment method, enter amount, calculate change
   - **Estimated**: 2 developer days

4. **Refund/Void UI** (RMS)
   - Location: Order details view
   - Features: Cancel order with reason, refund payment with reason
   - **Estimated**: 2 developer days

5. **Reports Dashboard** (RMS)
   - Location: `/hub/(owner-admin)/reports`
   - Features: Sales, Top Items, Payments, Order Status, Staff Activity
   - **Estimated**: 3 developer days

6. **Table State Dashboard** (RMS)
   - Location: `/hub/(owner-admin)/tables` (enhance existing)
   - Features: Color-coded table status, quick state transitions
   - **Estimated**: 2 developer days

**Estimated Total**: 17.5 developer days

---

### MEDIUM (Enhancements - Nice to Have)

**Backend**:
1. **Discount System** (Discount model + application logic)
   - **Estimated**: 2 developer days

2. **Preparation Times** (MenuItem.preparationTimeMinutes)
   - **Estimated**: 0.5 developer days

3. **CSV Export for Reports** (Export endpoints)
   - **Estimated**: 1 developer day

**Frontend**:
1. **Discount Application UI** (RMS)
   - **Estimated**: 2 developer days

2. **KDS Color Indicators for Delays** (Frontend only)
   - **Estimated**: 1 developer day

3. **KDS Routing Area Tabs** (Frontend filtering)
   - **Estimated**: 1 developer day

4. **Quick "86" Toggle** (RMS menu page)
   - **Estimated**: 0.5 developer days

**Estimated Total**: 8 developer days

---

### LOW (Future Considerations)

1. **Floor Areas** (Table.floorArea field)
   - **Estimated**: 1 developer day

2. **Combine/Transfer Tables** (Session merge logic)
   - **Estimated**: 2 developer days

3. **Audit Logging Dashboard** (View refund/void logs)
   - **Estimated**: 2 developer days

**Estimated Total**: 5 developer days

---

## Dependencies & Sequencing

### Phase 1 (Immediate - Week 1)
**Blockers must be resolved first:**

1. **QR Code Generation UI** (Frontend RMS)
   - Enables: Table ordering deployment

### Phase 2 (Core Functionality - Week 2-3)
**These can be parallelized:**

**Backend Team**:
- Routing Areas for KDS
- Change Calculation for Cash Payments
- Table State Management

**Frontend Team (RMS)**:
- Manual Order Creation
- Payment Recording UI
- Table State Dashboard

**Frontend Team (SOS)**:
- Bill Splitting (shared with RMS)

### Phase 3 (Reports & Refunds - Week 3-4)
**After Phase 2 complete:**

- Reports Dashboard (RMS)
- Refund/Void UI (RMS)
- Staff Activity Report (Backend)

### Phase 4 (Enhancements - Week 4-5)
**Optional but recommended:**

- Discount System (Backend + Frontend)
- KDS Color Indicators
- Preparation Times
- CSV Export

### Phase 5 (Future)
**Post-MVP:**

- Floor Areas
- Combine/Transfer Tables
- Audit Logging Dashboard

---

## Recommendations

### Top 5 Priorities for Slice A Completion

1. **QR Code Generation UI (CRITICAL)**
   - Without this, table ordering cannot be deployed
   - Quick win (2 days)
   - High ROI (enables core customer flow)

2. **RMS Manual Order Creation (HIGH)**
   - Essential for staff-initiated orders (phone, counter)
   - Fills major gap in POS functionality
   - Required for full RMS operations

3. **Payment Recording UI (HIGH)**
   - Complete the checkout flow for staff
   - Include change calculation for cash
   - Critical for closing the order lifecycle

4. **Reports Dashboard (HIGH)**
   - Business insights are essential for store owners
   - Backend APIs already exist (quick frontend implementation)
   - High business value

5. **Bill Splitting (HIGH)**
   - Common use case in restaurants
   - Requires backend refactoring (plan carefully)
   - High user impact

### Architecture Recommendations

1. **Separate "Check" Concept from "Order"**
   - Currently, "check" and "order" are conflated
   - Consider: Check = dining session with multiple orders
   - Would enable better table management and splitting

2. **Add Audit Logging Service**
   - Refunds, voids, discounts need audit trail
   - Create dedicated AuditLog model
   - Log all sensitive actions with userId, action, reason

3. **KDS Real-time Updates**
   - Consider WebSocket for KDS order updates
   - CartModule already uses Socket.io
   - Extend pattern to KDS for instant order notifications

4. **State Machine for Order/Table States**
   - Enforce valid state transitions
   - Prevent invalid operations (e.g., serving cancelled order)
   - Add transition validation in services

---

## Acceptance Criteria for Slice A Completion

**Backend**:
- [x] Order management endpoints exist
- [x] Payment recording endpoints exist
- [x] Report generation endpoints exist
- [x] Table management endpoints exist
- [x] Menu management endpoints exist
- [x] KDS endpoints exist
- [ ] Routing areas implemented
- [ ] Change calculation implemented
- [ ] Table state tracking implemented
- [ ] Staff activity report implemented

**Frontend RMS**:
- [ ] QR code generation and printing
- [ ] Manual order creation (table and counter)
- [ ] Payment recording with change calculation
- [ ] Refund and void with reason codes
- [ ] Reports dashboard with 5 report types
- [ ] Table state management dashboard
- [ ] Discount application UI
- [ ] Quick "86" toggle for menu items

**Frontend SOS**:
- [x] QR code scanning and session join
- [x] Menu browsing and cart
- [x] Checkout flow
- [ ] Bill splitting
- [ ] Payment summary before order

**Quality**:
- [x] Backend tests pass (257 tests)
- [x] Critical modules >85% coverage
- [ ] Frontend RMS tests for new features
- [ ] Frontend SOS tests for new features
- [ ] Integration tests for order lifecycle
- [ ] E2E tests for table ordering flow

---

## Risk Assessment

### Technical Risks

1. **Bill Splitting Complexity** (HIGH)
   - Current Payment model assumes single payment per order
   - Requires significant refactoring or new "PaymentAllocation" model
   - Recommendation: Design carefully before implementation

2. **State Management Consistency** (MEDIUM)
   - Table states vs. Session states vs. Order states must stay in sync
   - Risk: Inconsistent state across entities
   - Recommendation: Use state machine pattern and transactions

3. **Real-time KDS Updates** (MEDIUM)
   - Currently KDS polls for orders
   - Risk: Delays in order notifications
   - Recommendation: Implement WebSocket for KDS (similar to Cart)

### Business Risks

1. **Missing QR Codes** (CRITICAL)
   - Without QR generation, cannot deploy table ordering
   - Blocker for customer self-service flow
   - **Mitigation**: Prioritize QR UI as Phase 1

2. **Incomplete POS Functionality** (HIGH)
   - Manual order creation missing limits RMS usability
   - Staff cannot handle phone orders or counter orders
   - **Mitigation**: Implement manual order creation in Phase 2

3. **No Business Insights** (HIGH)
   - Reports exist on backend but no frontend UI
   - Owners cannot make data-driven decisions
   - **Mitigation**: Implement reports dashboard in Phase 3

---

## Conclusion

**Release Slice A is 75% complete**, with solid backend foundations but significant frontend gaps. The backend has excellent test coverage and robust APIs, but the frontend needs substantial development to expose this functionality to users.

**Critical Path**: QR Code Generation → Manual Order Creation → Payment UI → Reports Dashboard

**Estimated Time to 100% Completion**: 15-20 developer days (3-4 weeks with parallel teams)

**Recommended Approach**:
1. Address CRITICAL blocker (QR codes) immediately
2. Parallelize HIGH priority items across backend and frontend teams
3. Defer MEDIUM and LOW priority items to post-MVP

**Next Steps**:
1. Review this gap analysis with stakeholders
2. Prioritize backlog based on business value
3. Create detailed implementation plans for top 5 priorities
4. Assign teams and begin development sprints

---

**Document End**
