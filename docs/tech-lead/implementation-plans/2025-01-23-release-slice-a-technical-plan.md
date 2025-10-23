# Release Slice A - Technical Implementation Plan

**Date**: January 23, 2025
**Agent**: Tech Lead Advisor
**Scope**: Full-Stack (Backend + Frontend)
**Status**: Final
**Based On**: Release Slice A Gap Analysis (2025-01-23)

---

## Executive Summary

This technical implementation plan addresses the **25% completion gap** in Release Slice A, focusing on missing features identified in the comprehensive gap analysis. The plan prioritizes the **critical blocker (QR Code UI)** and **high-impact features** required for a production-ready restaurant management system.

**Key Metrics**:
- **Overall Completion**: 75% → 100% target
- **Backend Gap**: 15% (minor schema additions, no breaking changes)
- **Frontend Gap**: 50% (significant UI implementation required)
- **Estimated Effort**: 15-20 developer days
- **Critical Blocker**: ✅ QR Code UI already implemented (not a blocker)

**Critical Finding**: The QR Code generation UI is **already implemented** at `/hub/(owner-admin)/tables/qr-code/page.tsx` with full print and download functionality. This removes the primary blocker identified in the gap analysis.

---

## Table of Contents

1. [Critical Blocker Assessment](#1-critical-blocker-assessment)
2. [Backend Technical Plan](#2-backend-technical-plan)
3. [Frontend Technical Plan](#3-frontend-technical-plan)
4. [Integration Points](#4-integration-points)
5. [Technical Risks & Mitigation](#5-technical-risks--mitigation)
6. [Implementation Sequence](#6-implementation-sequence)
7. [Quality Gates & Testing Strategy](#7-quality-gates--testing-strategy)
8. [Appendix: Detailed Specifications](#8-appendix-detailed-specifications)

---

## 1. Critical Blocker Assessment

### 1.1 QR Code Generation UI (RESOLVED)

**Gap Analysis Claim**: "CRITICAL: QR Code Generation UI missing in RMS"

**Reality**: Feature is **fully implemented** at:
- **File**: `origin-food-house-frontend/apps/restaurant-management-system/src/app/[locale]/hub/(owner-admin)/tables/qr-code/page.tsx`
- **Route**: `/hub/(owner-admin)/tables/qr-code`

**Implemented Features**:
- ✅ QR code generation for all tables (using `qrcode.react`)
- ✅ Bulk print all QR codes (using `react-to-print`)
- ✅ Individual QR code download as PNG
- ✅ Proper QR URL format: `{CUSTOMER_APP_URL}/table-sessions/join-by-table-id/{tableId}`
- ✅ Responsive grid layout (1-4 columns)
- ✅ Loading skeletons and error states
- ✅ i18n support (4 languages)
- ✅ Print-optimized CSS

**Technical Details**:
```typescript
// QR URL format
const qrValue = `${customerAppBaseUrl}/table-sessions/join-by-table-id/${table.id}`;

// QR code generation (160x160, high error correction)
<QRCodeCanvas
  id={`qr-canvas-${table.id}`}
  value={qrValue}
  size={160}
  level={'H'}
  marginSize={8}
/>

// Print functionality
const handlePrint = useReactToPrint({
  contentRef: printRef,
  documentTitle: `table-qr-codes-${selectedStoreId}`,
});

// Download individual QR
const canvas = document.getElementById(`qr-canvas-${table.id}`);
const pngUrl = canvas.toDataURL('image/png');
const downloadLink = document.createElement('a');
downloadLink.href = pngUrl;
downloadLink.download = `table-qr-${tableName}-${tableId}.png`;
```

**Assessment**: No work required. This is **production-ready**.

**Recommendation**: Update gap analysis to reflect current implementation status.

---

## 2. Backend Technical Plan

### 2.1 Routing Areas for KDS

**Priority**: HIGH
**Complexity**: MEDIUM
**Estimated Effort**: 1 developer day
**Risk**: LOW (schema addition only)

#### Technical Specification

**Database Schema Changes**:

```prisma
// Add to schema.prisma

enum RoutingArea {
  GRILL
  FRY
  SALAD
  DRINKS
  DESSERT
  OTHER
}

model MenuItem {
  // ... existing fields
  routingArea RoutingArea? @default(OTHER)
  preparationTimeMinutes Int? // Bonus field for KDS timers
}
```

**Migration Plan**:
```bash
# Create migration
npx prisma migrate dev --name add-routing-area-to-menu-item

# Migration script will:
# 1. Add routingArea column (nullable, default OTHER)
# 2. Add preparationTimeMinutes column (nullable)
# 3. No data migration required (existing items default to OTHER)
```

**API Changes**:

1. **Update DTO** (`menu/dto/create-menu-item.dto.ts`):
```typescript
export class CreateMenuItemDto {
  // ... existing fields

  @IsOptional()
  @IsEnum(RoutingArea)
  routingArea?: RoutingArea;

  @IsOptional()
  @IsInt()
  @Min(1)
  preparationTimeMinutes?: number;
}
```

2. **Update Service** (`menu/menu.service.ts`):
```typescript
// No business logic changes required
// Prisma will automatically handle new fields
```

3. **Update Kitchen Endpoint** (`kitchen/kitchen.controller.ts`):
```typescript
@Get('orders')
async getKitchenOrders(
  @Query('storeId') storeId: string,
  @Query('routingArea') routingArea?: RoutingArea, // NEW
  @Query('status') status?: OrderStatus,
  @GetUser('sub') userId?: string
) {
  return this.kitchenService.getOrders(
    storeId,
    userId,
    { routingArea, status }
  );
}
```

4. **Update Kitchen Service** (`kitchen/kitchen.service.ts`):
```typescript
async getOrders(
  storeId: string,
  userId?: string,
  filters?: { routingArea?: RoutingArea; status?: OrderStatus }
): Promise<Order[]> {
  await this.authService.checkStorePermission(
    userId,
    storeId,
    [Role.OWNER, Role.ADMIN, Role.CHEF]
  );

  return this.prisma.order.findMany({
    where: {
      storeId,
      status: filters?.status,
      // Filter by routing area if specified
      ...(filters?.routingArea && {
        orderItems: {
          some: {
            menuItem: {
              routingArea: filters.routingArea
            }
          }
        }
      })
    },
    include: {
      orderItems: {
        where: filters?.routingArea
          ? { menuItem: { routingArea: filters.routingArea } }
          : undefined,
        include: {
          menuItem: {
            select: { routingArea: true, preparationTimeMinutes: true }
          },
          customizations: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
}
```

**Testing Requirements**:
```typescript
describe('KitchenService - Routing Areas', () => {
  it('should filter orders by routing area GRILL', async () => {});
  it('should return all items when no routing area specified', async () => {});
  it('should exclude items from other routing areas', async () => {});
  it('should handle orders with mixed routing areas', async () => {});
});
```

**Breaking Changes**: None (additive only)

---

### 2.2 Change Calculation for Cash Payments

**Priority**: HIGH
**Complexity**: LOW
**Estimated Effort**: 0.5 developer days
**Risk**: LOW (single field addition)

#### Technical Specification

**Database Schema Changes**:

```prisma
model Payment {
  id              String        @id @default(uuid(7))
  orderId         String
  amount          Decimal       @db.Decimal(10, 2)
  amountTendered  Decimal?      @db.Decimal(10, 2) // NEW: For cash payments
  paymentMethod   PaymentMethod
  transactionId   String?
  notes           String?

  // ... rest of model
}
```

**Migration Plan**:
```bash
npx prisma migrate dev --name add-amount-tendered-to-payment

# Migration: Add nullable column (no default required)
```

**API Changes**:

1. **Update DTO** (`payment/dto/record-payment.dto.ts`):
```typescript
export class RecordPaymentDto {
  @IsDecimal()
  @IsNotEmpty()
  amount: string; // Actual amount to record

  @IsOptional()
  @IsDecimal()
  amountTendered?: string; // For cash: amount given by customer

  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

2. **Update Service** (`payment/payment.service.ts`):
```typescript
async recordPayment(
  userId: string,
  orderId: string,
  dto: RecordPaymentDto
): Promise<PaymentResponseDto> {
  const method = this.recordPayment.name;

  // Validate store ownership (existing security)
  const order = await this.validateOrderStoreAccess(
    orderId,
    userId,
    [Role.OWNER, Role.ADMIN, Role.CASHIER]
  );

  // Validate amount tendered for cash payments
  if (dto.paymentMethod === PaymentMethod.CASH && dto.amountTendered) {
    const tendered = new Decimal(dto.amountTendered);
    const amount = new Decimal(dto.amount);

    if (tendered.lessThan(amount)) {
      throw new BadRequestException(
        'Amount tendered cannot be less than payment amount'
      );
    }
  }

  const payment = await this.prisma.payment.create({
    data: {
      orderId,
      amount: new Decimal(dto.amount),
      amountTendered: dto.amountTendered
        ? new Decimal(dto.amountTendered)
        : null,
      paymentMethod: dto.paymentMethod,
      transactionId: dto.transactionId,
      notes: dto.notes,
    },
  });

  this.logger.log(`[${method}] Payment recorded: ${payment.id}`);

  return this.mapToResponseDto(payment);
}
```

3. **Add Change Calculation Helper**:
```typescript
// payment/payment.service.ts

calculateChange(payment: Payment): string | null {
  if (!payment.amountTendered || payment.paymentMethod !== PaymentMethod.CASH) {
    return null;
  }

  const change = new Decimal(payment.amountTendered)
    .minus(new Decimal(payment.amount))
    .toFixed(2);

  return change;
}

// Include in response DTO
mapToResponseDto(payment: Payment): PaymentResponseDto {
  return {
    ...payment,
    amount: payment.amount.toString(),
    amountTendered: payment.amountTendered?.toString() || null,
    change: this.calculateChange(payment),
  };
}
```

**Response DTO**:
```typescript
export class PaymentResponseDto {
  id: string;
  orderId: string;
  amount: string;
  amountTendered: string | null;
  change: string | null; // Calculated field
  paymentMethod: PaymentMethod;
  transactionId: string | null;
  notes: string | null;
  createdAt: Date;
}
```

**Testing Requirements**:
```typescript
describe('PaymentService - Change Calculation', () => {
  it('should calculate change for cash payment', async () => {
    // amountTendered: 100, amount: 85.50 → change: 14.50
  });

  it('should reject tendered amount less than payment', async () => {
    // amountTendered: 50, amount: 100 → BadRequestException
  });

  it('should return null change for non-cash payments', async () => {});

  it('should handle exact change (zero)', async () => {
    // amountTendered: 100, amount: 100 → change: 0.00
  });

  it('should use Decimal precision for calculations', async () => {
    // Test edge cases: 99.99, 0.01, etc.
  });
});
```

**Breaking Changes**: None (optional field)

---

### 2.3 Table State Management

**Priority**: HIGH
**Complexity**: MEDIUM
**Estimated Effort**: 1 developer day
**Risk**: MEDIUM (state transition logic)

#### Technical Specification

**Database Schema Changes**:

```prisma
enum TableStatus {
  VACANT        // No active session
  SEATED        // Session created, no orders yet
  ORDERING      // Orders placed, being prepared
  SERVED        // Food served, awaiting payment
  READY_TO_PAY  // Check requested
  CLEANING      // Session closed, table needs cleaning
}

model Table {
  id            String       @id @default(uuid(7))
  storeId       String
  name          String
  currentStatus TableStatus  @default(VACANT) // NEW
  floorArea     String?      // NEW (bonus field)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @default(now()) @updatedAt

  // ... relations

  @@index([storeId, currentStatus]) // NEW index
}
```

**State Transition Rules**:

```typescript
// table/table.constants.ts

export const TABLE_STATE_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  VACANT: [TableStatus.SEATED],
  SEATED: [TableStatus.ORDERING, TableStatus.VACANT], // Can cancel before ordering
  ORDERING: [TableStatus.SERVED],
  SERVED: [TableStatus.READY_TO_PAY],
  READY_TO_PAY: [TableStatus.CLEANING],
  CLEANING: [TableStatus.VACANT],
};

export function isValidTransition(
  from: TableStatus,
  to: TableStatus
): boolean {
  return TABLE_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}
```

**API Changes**:

1. **New Endpoint** (`table/table.controller.ts`):
```typescript
@Patch(':id/status')
async updateTableStatus(
  @Param('id') tableId: string,
  @Body() dto: UpdateTableStatusDto,
  @GetUser('sub') userId: string
) {
  return this.tableService.updateTableStatus(userId, tableId, dto);
}
```

2. **DTO**:
```typescript
export class UpdateTableStatusDto {
  @IsEnum(TableStatus)
  @IsNotEmpty()
  status: TableStatus;

  @IsOptional()
  @IsString()
  reason?: string; // For audit logging
}
```

3. **Service Logic** (`table/table.service.ts`):
```typescript
async updateTableStatus(
  userId: string,
  tableId: string,
  dto: UpdateTableStatusDto
): Promise<TableResponseDto> {
  const method = this.updateTableStatus.name;

  const table = await this.prisma.table.findUnique({
    where: { id: tableId },
    include: { store: true }
  });

  if (!table) {
    throw new NotFoundException('Table not found');
  }

  // RBAC check
  await this.authService.checkStorePermission(
    userId,
    table.storeId,
    [Role.OWNER, Role.ADMIN, Role.SERVER]
  );

  // Validate state transition
  if (!isValidTransition(table.currentStatus, dto.status)) {
    throw new BadRequestException(
      `Invalid state transition from ${table.currentStatus} to ${dto.status}`
    );
  }

  const updated = await this.prisma.table.update({
    where: { id: tableId },
    data: { currentStatus: dto.status },
  });

  this.logger.log(
    `[${method}] Table ${tableId} status: ${table.currentStatus} → ${dto.status}`
  );

  return this.mapToResponseDto(updated);
}
```

4. **Automatic State Transitions**:

Hook into existing events:

```typescript
// active-table-session/active-table-session.service.ts

async createSession(...) {
  // ... existing logic

  // Update table status to SEATED
  await this.tableService.updateTableStatusInternal(
    tableId,
    TableStatus.SEATED
  );
}

async closeSession(...) {
  // ... existing logic

  // Update table status to CLEANING
  await this.tableService.updateTableStatusInternal(
    sessionId.tableId,
    TableStatus.CLEANING
  );
}

// order/order.service.ts

async createOrder(...) {
  // ... after order creation

  if (session) {
    await this.tableService.updateTableStatusInternal(
      session.tableId,
      TableStatus.ORDERING
    );
  }
}

async updateOrderStatus(orderId, status) {
  // ... existing logic

  if (status === OrderStatus.SERVED) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { session: true }
    });

    if (order.session) {
      await this.tableService.updateTableStatusInternal(
        order.session.tableId,
        TableStatus.SERVED
      );
    }
  }
}
```

**Testing Requirements**:
```typescript
describe('TableService - State Management', () => {
  it('should transition from VACANT to SEATED', async () => {});
  it('should reject invalid transitions (VACANT → SERVED)', async () => {});
  it('should enforce RBAC on status updates', async () => {});
  it('should automatically update on session creation', async () => {});
  it('should automatically update on order completion', async () => {});
  it('should handle concurrent state updates', async () => {});
});
```

**Breaking Changes**: None (new column with default)

---

### 2.4 Staff Activity Report

**Priority**: HIGH
**Complexity**: LOW
**Estimated Effort**: 0.5 developer days
**Risk**: LOW (read-only endpoint)

#### Technical Specification

**API Endpoint** (`report/report.controller.ts`):

```typescript
@Get('staff-activity')
async getStaffActivityReport(
  @Query('storeId') storeId: string,
  @Query('startDate') startDate?: string,
  @Query('endDate') endDate?: string,
  @GetUser('sub') userId?: string
) {
  return this.reportService.getStaffActivityReport(
    storeId,
    userId,
    { startDate, endDate }
  );
}
```

**Service Implementation** (`report/report.service.ts`):

```typescript
async getStaffActivityReport(
  storeId: string,
  userId: string,
  filters: { startDate?: string; endDate?: string }
): Promise<StaffActivityReportDto> {
  const method = this.getStaffActivityReport.name;

  // RBAC: Only OWNER/ADMIN can view staff activity
  await this.authService.checkStorePermission(
    userId,
    storeId,
    [Role.OWNER, Role.ADMIN]
  );

  const dateFilter = this.buildDateFilter(filters);

  // Get all staff members for this store
  const staffMembers = await this.prisma.userStore.findMany({
    where: { storeId },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  // Get activity metrics per staff member
  const activityByStaff = await Promise.all(
    staffMembers.map(async (member) => {
      const [ordersCreated, paymentsRecorded, refundsIssued] = await Promise.all([
        // Count orders (from session/user context - needs implementation)
        this.prisma.order.count({
          where: {
            storeId,
            ...dateFilter,
            // TODO: Add createdBy field to Order model
          }
        }),

        // Count payments (from Payment.notes or new field)
        this.prisma.payment.count({
          where: {
            order: { storeId },
            ...dateFilter,
            // TODO: Add recordedBy field to Payment model
          }
        }),

        // Count refunds
        this.prisma.refund.count({
          where: {
            order: { storeId },
            refundedBy: member.userId,
            ...dateFilter
          }
        })
      ]);

      return {
        userId: member.user.id,
        userName: member.user.name || member.user.email,
        role: member.role,
        ordersCreated,
        paymentsRecorded,
        refundsIssued,
        totalActivity: ordersCreated + paymentsRecorded + refundsIssued
      };
    })
  );

  return {
    storeId,
    period: {
      startDate: filters.startDate || 'all-time',
      endDate: filters.endDate || 'now'
    },
    staffActivity: activityByStaff.sort((a, b) => b.totalActivity - a.totalActivity),
    totalStaff: staffMembers.length
  };
}
```

**Required Schema Changes** (Bonus):

```prisma
model Order {
  // ... existing fields
  createdBy String? // User ID who created the order
  createdByUser User? @relation("OrderCreatedBy", fields: [createdBy], references: [id])
}

model Payment {
  // ... existing fields
  recordedBy String? // User ID who recorded the payment
  recordedByUser User? @relation("PaymentRecordedBy", fields: [recordedBy], references: [id])
}

// Add reverse relations to User model
model User {
  // ... existing fields
  ordersCreated Order[] @relation("OrderCreatedBy")
  paymentsRecorded Payment[] @relation("PaymentRecordedBy")
}
```

**Testing Requirements**:
```typescript
describe('ReportService - Staff Activity', () => {
  it('should return activity for all staff members', async () => {});
  it('should filter by date range', async () => {});
  it('should sort by total activity descending', async () => {});
  it('should enforce OWNER/ADMIN RBAC', async () => {});
  it('should handle store with no activity', async () => {});
});
```

**Breaking Changes**: None (new endpoint)

---

### 2.5 Bill Splitting (Partial Payments)

**Priority**: HIGH
**Complexity**: HIGH
**Estimated Effort**: 2 developer days
**Risk**: HIGH (requires refactoring payment model)

#### Technical Specification

**Current Limitation**:
- One `Payment` per `Order` assumed in business logic
- No concept of "partial payment" or "payment allocation"

**Proposed Solution**: Multi-payment support (simpler than full split tracking)

**Database Schema Changes**:

```prisma
// No schema changes needed!
// Payment model already supports multiple payments per order via relation

model Order {
  // ... existing fields
  payments Payment[] // Already many-to-many

  // Add computed field helper
  totalPaid Decimal @default(0) @db.Decimal(10, 2) // Cache for performance
}
```

**Business Logic Changes**:

1. **Allow multiple payments per order**:

```typescript
// payment/payment.service.ts

async recordPayment(
  userId: string,
  orderId: string,
  dto: RecordPaymentDto
): Promise<PaymentResponseDto> {
  const method = this.recordPayment.name;

  const order = await this.validateOrderStoreAccess(orderId, userId, [Role.OWNER, Role.ADMIN, Role.CASHIER]);

  // Calculate total paid so far
  const existingPayments = await this.prisma.payment.findMany({
    where: { orderId }
  });

  const totalPaid = existingPayments.reduce(
    (sum, p) => sum.plus(p.amount),
    new Decimal(0)
  );

  const newPaymentAmount = new Decimal(dto.amount);
  const newTotal = totalPaid.plus(newPaymentAmount);

  // Validate: total payments cannot exceed grand total
  if (newTotal.greaterThan(new Decimal(order.grandTotal))) {
    throw new BadRequestException(
      `Payment amount exceeds remaining balance. ` +
      `Remaining: ${order.grandTotal.minus(totalPaid).toFixed(2)}`
    );
  }

  // Record payment
  const payment = await this.prisma.$transaction(async (tx) => {
    const newPayment = await tx.payment.create({
      data: {
        orderId,
        amount: newPaymentAmount,
        amountTendered: dto.amountTendered ? new Decimal(dto.amountTendered) : null,
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        notes: dto.notes,
      },
    });

    // Update order.totalPaid cache
    await tx.order.update({
      where: { id: orderId },
      data: {
        totalPaid: newTotal,
        // Mark as COMPLETED if fully paid
        ...(newTotal.equals(order.grandTotal) && {
          status: OrderStatus.COMPLETED,
          paidAt: new Date()
        })
      }
    });

    return newPayment;
  });

  this.logger.log(
    `[${method}] Partial payment recorded: ${payment.amount.toString()} ` +
    `(${newTotal.toString()} / ${order.grandTotal.toString()})`
  );

  return this.mapToResponseDto(payment);
}
```

2. **Get Payment Summary**:

```typescript
async getPaymentSummary(
  userId: string,
  orderId: string
): Promise<PaymentSummaryDto> {
  const order = await this.validateOrderStoreAccess(orderId, userId, [
    Role.OWNER, Role.ADMIN, Role.CASHIER, Role.SERVER
  ]);

  const payments = await this.prisma.payment.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' }
  });

  const totalPaid = payments.reduce(
    (sum, p) => sum.plus(p.amount),
    new Decimal(0)
  );

  const remaining = new Decimal(order.grandTotal).minus(totalPaid);

  return {
    orderId,
    grandTotal: order.grandTotal.toString(),
    totalPaid: totalPaid.toString(),
    remainingBalance: remaining.toString(),
    isFullyPaid: remaining.equals(0),
    payments: payments.map(this.mapToResponseDto),
    paymentCount: payments.length
  };
}
```

**Frontend Implications**:
- UI must show "Add Payment" (not "Record Payment")
- Display running total of payments
- Show remaining balance
- Allow multiple payment methods per order

**Testing Requirements**:
```typescript
describe('PaymentService - Bill Splitting', () => {
  it('should allow multiple payments for one order', async () => {});
  it('should reject payment exceeding remaining balance', async () => {});
  it('should mark order COMPLETED when fully paid', async () => {});
  it('should handle split payment with different methods', async () => {});
  it('should calculate remaining balance correctly', async () => {});
  it('should use Decimal precision for split totals', async () => {});
});
```

**Alternative Approach** (More Complex):

Create `PaymentAllocation` model for item-level splitting:

```prisma
model PaymentAllocation {
  id            String   @id @default(uuid(7))
  paymentId     String
  orderItemId   String?  // Optional: for item-level splits
  amount        Decimal  @db.Decimal(10, 2)

  payment   Payment   @relation(fields: [paymentId], references: [id])
  orderItem OrderItem? @relation(fields: [orderItemId], references: [id])
}
```

**Recommendation**: Start with **multi-payment approach** (simpler). Add item-level splitting later if business requires it.

**Breaking Changes**: None (additive only)

---

## 3. Frontend Technical Plan

### 3.1 Manual Order Creation (RMS)

**Priority**: HIGH
**Complexity**: HIGH
**Estimated Effort**: 3 developer days
**Risk**: MEDIUM (complex workflow)

#### Technical Specification

**Location**: Enhance `/hub/sale` page (currently empty placeholder)

**File**: `origin-food-house-frontend/apps/restaurant-management-system/src/app/[locale]/hub/sale/page.tsx`

**Components Architecture**:

```
SalePage (Container)
├── OrderTypeSelector (Table vs Counter)
├── TableSelector (if table order)
├── OrderItemsBuilder
│   ├── MenuItemSearch (with category filter)
│   ├── OrderItemCard (editable quantity, customizations, notes)
│   └── OrderSummary (subtotal, VAT, service charge, grand total)
└── CheckoutActions (Create Order, Cancel)
```

**Component Specifications**:

1. **OrderTypeSelector**:
```typescript
// features/sales/components/OrderTypeSelector.tsx

interface OrderTypeSelectorProps {
  selectedType: 'DINE_IN' | 'TAKEAWAY';
  onSelect: (type: 'DINE_IN' | 'TAKEAWAY') => void;
}

// Use @repo/ui RadioGroup or ToggleGroup
import { ToggleGroup, ToggleGroupItem } from '@repo/ui/components/toggle-group';
```

2. **TableSelector**:
```typescript
// features/sales/components/TableSelector.tsx

interface TableSelectorProps {
  storeId: string;
  selectedTableId: string | null;
  onSelect: (tableId: string) => void;
}

// Implementation:
// - Fetch tables via useQuery(tablesKeys.all(storeId))
// - Display as grid of buttons (show table name + status)
// - Use @repo/ui Button with variant based on table status
// - Filter out tables with ORDERING/SERVED/READY_TO_PAY status
```

3. **MenuItemSearch**:
```typescript
// features/sales/components/MenuItemSearch.tsx

interface MenuItemSearchProps {
  storeId: string;
  onAddItem: (item: MenuItem, customizations: Customization[]) => void;
}

// Features:
// - Search input (debounced)
// - Category filter dropdown (use @repo/ui Select)
// - Display items as cards (use @repo/ui Card)
// - Click to open customization modal
// - Use existing menu services from features/menu
```

4. **OrderItemCard**:
```typescript
// features/sales/components/OrderItemCard.tsx

interface OrderItemCardProps {
  item: OrderItem;
  onUpdateQuantity: (quantity: number) => void;
  onUpdateNotes: (notes: string) => void;
  onRemove: () => void;
}

// Use @repo/ui components:
// - Card
// - Input (for quantity, type="number")
// - Textarea (for notes)
// - Button (for remove)
```

5. **OrderSummary**:
```typescript
// features/sales/components/OrderSummary.tsx

interface OrderSummaryProps {
  items: OrderItem[];
  vatRate: Decimal;
  serviceChargeRate: Decimal;
}

// Display:
// - Subtotal
// - VAT (calculated)
// - Service Charge (calculated)
// - Grand Total
// - Use Decimal.js for calculations (avoid float errors)
```

**State Management**:

Use local state (React.useState) + Zustand for cart:

```typescript
// features/sales/store/manual-order.store.ts

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

interface OrderItem {
  menuItemId: string;
  menuItemName: string;
  basePrice: string;
  quantity: number;
  customizations: Customization[];
  notes?: string;
}

interface ManualOrderState {
  orderType: 'DINE_IN' | 'TAKEAWAY';
  tableId: string | null;
  tableName: string | null;
  items: OrderItem[];

  // Actions
  setOrderType: (type: 'DINE_IN' | 'TAKEAWAY') => void;
  setTable: (tableId: string, tableName: string) => void;
  addItem: (item: OrderItem) => void;
  updateItemQuantity: (index: number, quantity: number) => void;
  updateItemNotes: (index: number, notes: string) => void;
  removeItem: (index: number) => void;
  clearOrder: () => void;
}

export const useManualOrderStore = create<ManualOrderState>()(
  devtools(
    immer((set) => ({
      orderType: 'DINE_IN',
      tableId: null,
      tableName: null,
      items: [],

      setOrderType: (type) => set((draft) => { draft.orderType = type; }),
      setTable: (tableId, tableName) => set((draft) => {
        draft.tableId = tableId;
        draft.tableName = tableName;
      }),
      addItem: (item) => set((draft) => { draft.items.push(item); }),
      updateItemQuantity: (index, quantity) => set((draft) => {
        if (draft.items[index]) {
          draft.items[index].quantity = quantity;
        }
      }),
      updateItemNotes: (index, notes) => set((draft) => {
        if (draft.items[index]) {
          draft.items[index].notes = notes;
        }
      }),
      removeItem: (index) => set((draft) => {
        draft.items.splice(index, 1);
      }),
      clearOrder: () => set((draft) => {
        draft.items = [];
        draft.tableId = null;
        draft.tableName = null;
      })
    })),
    { name: 'manual-order-store' }
  )
);
```

**API Service**:

```typescript
// features/sales/services/manual-order.service.ts

import { apiFetch, unwrapData } from '@/utils/apiFetch';
import type { CreateOrderDto, OrderResponseDto } from '@repo/api/generated/types';

export async function createManualOrder(
  storeId: string,
  data: CreateOrderDto
): Promise<OrderResponseDto> {
  const res = await apiFetch<OrderResponseDto>({
    path: '/orders/manual', // NEW ENDPOINT
    method: 'POST',
    query: { storeId },
    body: JSON.stringify(data),
  });
  return unwrapData(res, 'Failed to create order');
}
```

**Backend Support** (New Endpoint):

```typescript
// order/order.controller.ts

@Post('manual')
async createManualOrder(
  @Query('storeId') storeId: string,
  @Body() dto: CreateManualOrderDto,
  @GetUser('sub') userId: string
) {
  return this.orderService.createManualOrder(userId, storeId, dto);
}

// order/dto/create-manual-order.dto.ts

export class CreateManualOrderDto {
  @IsEnum(OrderType)
  orderType: OrderType; // DINE_IN or TAKEAWAY

  @IsOptional()
  @IsUUID()
  tableId?: string; // Required if DINE_IN

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class OrderItemDto {
  @IsUUID()
  menuItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsArray()
  @IsUUID({ each: true })
  customizationIds?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
```

**User Flow**:

1. Staff navigates to `/hub/sale`
2. Selects order type (Table or Counter)
3. If table: selects from available tables
4. Searches/browses menu items
5. Clicks item → opens customization modal (if applicable)
6. Adds to order (accumulates in state)
7. Edits quantity/notes as needed
8. Reviews order summary
9. Clicks "Create Order"
10. Backend creates order without session (manual flow)
11. Success toast + redirect to order details

**Testing Requirements**:

```typescript
// manual-order.test.tsx

describe('Manual Order Creation', () => {
  it('should select order type', () => {});
  it('should show table selector for DINE_IN', () => {});
  it('should add items to order', () => {});
  it('should update item quantity', () => {});
  it('should calculate totals correctly', () => {});
  it('should create order via API', () => {});
  it('should enforce RBAC (SERVER, CASHIER, ADMIN, OWNER)', () => {});
});
```

**Shared Components to Reuse**:
- ✅ `@repo/ui/components/button`
- ✅ `@repo/ui/components/card`
- ✅ `@repo/ui/components/input`
- ✅ `@repo/ui/components/select`
- ✅ `@repo/ui/components/dialog`
- ✅ `@repo/ui/components/toggle-group`

**Breaking Changes**: None (new page)

---

### 3.2 Payment Recording UI (RMS)

**Priority**: HIGH
**Complexity**: MEDIUM
**Estimated Effort**: 2 developer days
**Risk**: LOW (straightforward form)

#### Technical Specification

**Location**: Modal/dialog component triggered from order details

**File**: `features/payments/components/RecordPaymentDialog.tsx`

**Component Architecture**:

```typescript
interface RecordPaymentDialogProps {
  orderId: string;
  grandTotal: string;
  remainingBalance: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordPaymentDialog({ ... }: RecordPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState(remainingBalance);
  const [amountTendered, setAmountTendered] = useState('');
  const [notes, setNotes] = useState('');

  const calculatedChange = useMemo(() => {
    if (paymentMethod !== 'CASH' || !amountTendered) return null;
    const tendered = new Decimal(amountTendered);
    const amt = new Decimal(amount);
    return tendered.minus(amt).toFixed(2);
  }, [paymentMethod, amount, amountTendered]);

  const recordPaymentMutation = useMutation({
    mutationFn: (data: RecordPaymentDto) => recordPayment(orderId, data),
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      queryClient.invalidateQueries({ queryKey: paymentKeys.order(orderId) });
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (paymentMethod === 'CASH' && amountTendered) {
      const tendered = new Decimal(amountTendered);
      const amt = new Decimal(amount);
      if (tendered.lessThan(amt)) {
        toast.error('Amount tendered must be greater than or equal to payment amount');
        return;
      }
    }

    recordPaymentMutation.mutate({
      amount,
      amountTendered: paymentMethod === 'CASH' ? amountTendered : undefined,
      paymentMethod,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Summary */}
          <div className="rounded-lg bg-muted p-4">
            <div className="flex justify-between">
              <span>Grand Total:</span>
              <span className="font-bold">${grandTotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining Balance:</span>
              <span className="font-bold">${remainingBalance}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                <SelectItem value="DEBIT_CARD">Debit Card</SelectItem>
                <SelectItem value="MOBILE_PAYMENT">Mobile Payment</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Amount */}
          <div>
            <Label>Payment Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Amount Tendered (Cash Only) */}
          {paymentMethod === 'CASH' && (
            <div>
              <Label>Amount Tendered</Label>
              <Input
                type="number"
                step="0.01"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                placeholder="Amount given by customer"
              />
            </div>
          )}

          {/* Change Display (Cash Only) */}
          {paymentMethod === 'CASH' && calculatedChange && (
            <Alert>
              <AlertDescription>
                <div className="flex justify-between text-lg font-bold">
                  <span>Change:</span>
                  <span className="text-green-600">${calculatedChange}</span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Notes */}
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordPaymentMutation.isPending}>
              {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Integration Points**:

1. **Order Details Page** (`features/orders/components/OrderDetailsPage.tsx`):

```typescript
export function OrderDetailsPage({ orderId }: { orderId: string }) {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const { data: paymentSummary } = useQuery({
    queryKey: paymentKeys.summary(orderId),
    queryFn: () => getPaymentSummary(orderId),
  });

  return (
    <div>
      {/* Order details ... */}

      {/* Payment Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Grand Total:</span>
              <span>${paymentSummary.grandTotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Paid:</span>
              <span>${paymentSummary.totalPaid}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Remaining Balance:</span>
              <span>${paymentSummary.remainingBalance}</span>
            </div>
          </div>

          {/* Payment History */}
          {paymentSummary.payments.map((payment) => (
            <div key={payment.id} className="mt-2 border-t pt-2">
              <div className="flex justify-between text-sm">
                <span>{payment.paymentMethod}</span>
                <span>${payment.amount}</span>
              </div>
              {payment.change && (
                <div className="text-xs text-muted-foreground">
                  Change: ${payment.change}
                </div>
              )}
            </div>
          ))}
        </CardContent>
        <CardFooter>
          {!paymentSummary.isFullyPaid && (
            <Button onClick={() => setIsPaymentDialogOpen(true)}>
              Record Payment
            </Button>
          )}
        </CardFooter>
      </Card>

      <RecordPaymentDialog
        orderId={orderId}
        grandTotal={paymentSummary.grandTotal}
        remainingBalance={paymentSummary.remainingBalance}
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        onSuccess={() => {
          // Refresh order details
        }}
      />
    </div>
  );
}
```

**Query Keys**:

```typescript
// features/payments/queries/payment.keys.ts

export const paymentKeys = {
  all: ['payments'] as const,
  order: (orderId: string) => [...paymentKeys.all, 'order', orderId] as const,
  summary: (orderId: string) => [...paymentKeys.order(orderId), 'summary'] as const,
};
```

**Services**:

```typescript
// features/payments/services/payment.service.ts

export async function recordPayment(
  orderId: string,
  data: RecordPaymentDto
): Promise<PaymentResponseDto> {
  const res = await apiFetch<PaymentResponseDto>({
    path: `/payments/orders/${orderId}`,
    method: 'POST',
    body: JSON.stringify(data),
  });
  return unwrapData(res, 'Failed to record payment');
}

export async function getPaymentSummary(
  orderId: string
): Promise<PaymentSummaryDto> {
  const res = await apiFetch<PaymentSummaryDto>({
    path: `/payments/orders/${orderId}/summary`,
    method: 'GET',
  });
  return unwrapData(res, 'Failed to fetch payment summary');
}
```

**Testing Requirements**:

```typescript
describe('RecordPaymentDialog', () => {
  it('should display order totals', () => {});
  it('should calculate change for cash payments', () => {});
  it('should validate tendered amount >= payment amount', () => {});
  it('should hide tendered amount for non-cash methods', () => {});
  it('should record payment via API', () => {});
  it('should invalidate cache on success', () => {});
});
```

**Breaking Changes**: None (new component)

---

### 3.3 Refund/Void UI (RMS)

**Priority**: HIGH
**Complexity**: MEDIUM
**Estimated Effort**: 2 developer days
**Risk**: LOW

#### Technical Specification

**Components**:

1. **RefundDialog** (`features/payments/components/RefundDialog.tsx`)
2. **CancelOrderDialog** (`features/orders/components/CancelOrderDialog.tsx`)

**RefundDialog**:

```typescript
interface RefundDialogProps {
  orderId: string;
  maxRefundAmount: string; // Total paid amount
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RefundDialog({ ... }: RefundDialogProps) {
  const [amount, setAmount] = useState(maxRefundAmount);
  const [reason, setReason] = useState('');

  const refundMutation = useMutation({
    mutationFn: (data: IssueRefundDto) => issueRefund(orderId, data),
    onSuccess: () => {
      toast.success('Refund issued successfully');
      queryClient.invalidateQueries({ queryKey: paymentKeys.order(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Validation
    const refundAmount = new Decimal(amount);
    const max = new Decimal(maxRefundAmount);

    if (refundAmount.greaterThan(max)) {
      toast.error(`Refund amount cannot exceed ${maxRefundAmount}`);
      return;
    }

    if (refundAmount.lessThanOrEqualTo(0)) {
      toast.error('Refund amount must be greater than zero');
      return;
    }

    refundMutation.mutate({ amount, reason });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Refund</DialogTitle>
          <DialogDescription>
            This action will refund the customer and update the order status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Refund Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={maxRefundAmount}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              Maximum refundable: ${maxRefundAmount}
            </p>
          </div>

          <div>
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason} required>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WRONG_ORDER">Wrong Order</SelectItem>
                <SelectItem value="QUALITY_ISSUE">Quality Issue</SelectItem>
                <SelectItem value="CUSTOMER_REQUEST">Customer Request</SelectItem>
                <SelectItem value="BILLING_ERROR">Billing Error</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This action cannot be undone. The refund will be recorded in the audit log.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending ? 'Processing...' : 'Issue Refund'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**CancelOrderDialog**:

```typescript
interface CancelOrderDialogProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelOrderDialog({ ... }: CancelOrderDialogProps) {
  const [reason, setReason] = useState('');

  const cancelMutation = useMutation({
    mutationFn: (data: CancelOrderDto) => cancelOrder(orderId, data),
    onSuccess: () => {
      toast.success('Order cancelled');
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      onSuccess();
      onClose();
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogDescription>
            This will cancel the order and mark it as void.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          cancelMutation.mutate({ reason });
        }} className="space-y-4">
          <div>
            <Label>Cancellation Reason</Label>
            <Select value={reason} onValueChange={setReason} required>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOMER_CANCEL">Customer Cancelled</SelectItem>
                <SelectItem value="OUT_OF_STOCK">Item Out of Stock</SelectItem>
                <SelectItem value="KITCHEN_ERROR">Kitchen Error</SelectItem>
                <SelectItem value="DUPLICATE_ORDER">Duplicate Order</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <AlertDescription>
              This action will update the order status to CANCELLED.
              If payment was recorded, issue a refund separately.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Keep Order
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Backend Support**:

```typescript
// order/order.controller.ts

@Patch(':id/cancel')
async cancelOrder(
  @Param('id') orderId: string,
  @Body() dto: CancelOrderDto,
  @GetUser('sub') userId: string
) {
  return this.orderService.cancelOrder(userId, orderId, dto);
}

// order/dto/cancel-order.dto.ts

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

// order/order.service.ts

async cancelOrder(
  userId: string,
  orderId: string,
  dto: CancelOrderDto
): Promise<OrderResponseDto> {
  const method = this.cancelOrder.name;

  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: { store: true, payments: true }
  });

  if (!order) {
    throw new NotFoundException('Order not found');
  }

  await this.authService.checkStorePermission(
    userId,
    order.storeId,
    [Role.OWNER, Role.ADMIN, Role.SERVER]
  );

  // Prevent cancellation of paid orders
  if (order.payments.length > 0) {
    throw new BadRequestException(
      'Cannot cancel order with payments. Issue refund instead.'
    );
  }

  const updated = await this.prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
      // Store cancel reason in notes or create audit log
    },
  });

  this.logger.log(`[${method}] Order ${orderId} cancelled: ${dto.reason}`);

  return this.mapToResponseDto(updated);
}
```

**Testing Requirements**:

```typescript
describe('Refund/Void UI', () => {
  it('should issue refund with reason', () => {});
  it('should validate refund amount <= total paid', () => {});
  it('should cancel unpaid orders', () => {});
  it('should prevent cancellation of paid orders', () => {});
  it('should enforce RBAC', () => {});
});
```

**Breaking Changes**: None (new components)

---

### 3.4 Reports Dashboard (RMS)

**Priority**: HIGH
**Complexity**: MEDIUM
**Estimated Effort**: 3 developer days
**Risk**: LOW

#### Technical Specification

**Location**: `/hub/(owner-admin)/reports`

**File**: `apps/restaurant-management-system/src/app/[locale]/hub/(owner-admin)/reports/page.tsx`

**Component Architecture**:

```
ReportsPage
├── DateRangePicker
├── ReportGrid
│   ├── SalesSummaryCard (uses Chart from @repo/ui)
│   ├── TopItemsCard (uses Table from @repo/ui)
│   ├── PaymentBreakdownCard (uses Chart from @repo/ui)
│   ├── OrderStatusCard (uses Chart from @repo/ui)
│   └── StaffActivityCard (uses Table from @repo/ui)
└── ExportButton (CSV download - future)
```

**DateRangePicker Component**:

```typescript
// features/reports/components/DateRangePicker.tsx

import { Button } from '@repo/ui/components/button';
import { Calendar } from '@repo/ui/components/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeChange: (start: Date | null, end: Date | null) => void;
}

export function DateRangePicker({ ... }: DateRangePickerProps) {
  // Quick presets
  const presets = [
    { label: 'Today', getValue: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }) },
    { label: 'This Week', getValue: () => ({ start: startOfWeek(new Date()), end: endOfWeek(new Date()) }) },
    { label: 'This Month', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
    { label: 'Last 30 Days', getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  ];

  return (
    <div className="flex gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          size="sm"
          onClick={() => {
            const { start, end } = preset.getValue();
            onRangeChange(start, end);
          }}
        >
          {preset.label}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Custom Range
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="range"
            selected={{ from: startDate, to: endDate }}
            onSelect={(range) => onRangeChange(range?.from, range?.to)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

**Sales Summary Card**:

```typescript
// features/reports/components/SalesSummaryCard.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { ChartContainer, ChartTooltip } from '@repo/ui/components/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

interface SalesSummaryCardProps {
  data: SalesSummaryDto;
  isLoading: boolean;
}

export function SalesSummaryCard({ data, isLoading }: SalesSummaryCardProps) {
  if (isLoading) return <Skeleton className="h-[400px]" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="text-2xl font-bold">${data.totalSales}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold">{data.totalOrders}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Order Value</p>
            <p className="text-2xl font-bold">${data.averageOrderValue}</p>
          </div>
        </div>

        {/* Chart */}
        <ChartContainer config={{ sales: { color: 'hsl(var(--primary))' } }}>
          <AreaChart data={data.dailySales}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <ChartTooltip />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="var(--color-sales)"
              fill="var(--color-sales)"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

**Top Items Card**:

```typescript
// features/reports/components/TopItemsCard.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table';

interface TopItemsCardProps {
  data: PopularItemsDto;
  isLoading: boolean;
}

export function TopItemsCard({ data, isLoading }: TopItemsCardProps) {
  if (isLoading) return <Skeleton className="h-[300px]" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Selling Items</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quantity Sold</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item, index) => (
              <TableRow key={item.menuItemId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">#{index + 1}</span>
                    <span className="font-medium">{item.itemName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{item.totalQuantity}</TableCell>
                <TableCell className="text-right">${item.totalRevenue}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

**Main Reports Page**:

```typescript
// app/[locale]/hub/(owner-admin)/reports/page.tsx

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, selectSelectedStoreId } from '@/features/auth/store/auth.store';
import { reportKeys } from '@/features/reports/queries/report.keys';
import {
  getSalesSummary,
  getTopItems,
  getPaymentBreakdown,
  getOrderStatus,
  getStaffActivity,
} from '@/features/reports/services/report.service';

export default function ReportsPage() {
  const selectedStoreId = useAuthStore(selectSelectedStoreId);
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfDay(new Date()));

  const dateRange = {
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
  };

  // Parallel queries for all reports
  const { data: salesSummary, isLoading: loadingSales } = useQuery({
    queryKey: reportKeys.salesSummary(selectedStoreId, dateRange),
    queryFn: () => getSalesSummary(selectedStoreId!, dateRange),
    enabled: !!selectedStoreId,
  });

  const { data: topItems, isLoading: loadingItems } = useQuery({
    queryKey: reportKeys.topItems(selectedStoreId, dateRange),
    queryFn: () => getTopItems(selectedStoreId!, dateRange),
    enabled: !!selectedStoreId,
  });

  const { data: paymentBreakdown, isLoading: loadingPayments } = useQuery({
    queryKey: reportKeys.paymentBreakdown(selectedStoreId, dateRange),
    queryFn: () => getPaymentBreakdown(selectedStoreId!, dateRange),
    enabled: !!selectedStoreId,
  });

  const { data: orderStatus, isLoading: loadingOrders } = useQuery({
    queryKey: reportKeys.orderStatus(selectedStoreId, dateRange),
    queryFn: () => getOrderStatus(selectedStoreId!, dateRange),
    enabled: !!selectedStoreId,
  });

  const { data: staffActivity, isLoading: loadingStaff } = useQuery({
    queryKey: reportKeys.staffActivity(selectedStoreId, dateRange),
    queryFn: () => getStaffActivity(selectedStoreId!, dateRange),
    enabled: !!selectedStoreId,
  });

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Track sales, orders, and staff performance
        </p>
      </header>

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onRangeChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <SalesSummaryCard data={salesSummary} isLoading={loadingSales} />
        <TopItemsCard data={topItems} isLoading={loadingItems} />
        <PaymentBreakdownCard data={paymentBreakdown} isLoading={loadingPayments} />
        <OrderStatusCard data={orderStatus} isLoading={loadingOrders} />
      </div>

      <StaffActivityCard data={staffActivity} isLoading={loadingStaff} />
    </div>
  );
}
```

**Query Keys**:

```typescript
// features/reports/queries/report.keys.ts

export const reportKeys = {
  all: ['reports'] as const,

  salesSummary: (storeId: string | null, dateRange: DateRange) =>
    [...reportKeys.all, 'sales-summary', storeId, dateRange] as const,

  topItems: (storeId: string | null, dateRange: DateRange) =>
    [...reportKeys.all, 'top-items', storeId, dateRange] as const,

  paymentBreakdown: (storeId: string | null, dateRange: DateRange) =>
    [...reportKeys.all, 'payment-breakdown', storeId, dateRange] as const,

  orderStatus: (storeId: string | null, dateRange: DateRange) =>
    [...reportKeys.all, 'order-status', storeId, dateRange] as const,

  staffActivity: (storeId: string | null, dateRange: DateRange) =>
    [...reportKeys.all, 'staff-activity', storeId, dateRange] as const,
};
```

**Services**:

```typescript
// features/reports/services/report.service.ts

export async function getSalesSummary(
  storeId: string,
  dateRange: DateRange
): Promise<SalesSummaryDto> {
  const res = await apiFetch<SalesSummaryDto>({
    path: '/reports/sales-summary',
    method: 'GET',
    query: { storeId, ...dateRange },
  });
  return unwrapData(res, 'Failed to fetch sales summary');
}

// Similar for other report types...
```

**Testing Requirements**:

```typescript
describe('Reports Dashboard', () => {
  it('should load all reports in parallel', () => {});
  it('should filter by date range', () => {});
  it('should display charts correctly', () => {});
  it('should enforce OWNER/ADMIN RBAC', () => {});
});
```

**Breaking Changes**: None (new page)

---

### 3.5 Table State Dashboard (RMS)

**Priority**: HIGH
**Complexity**: MEDIUM
**Estimated Effort**: 2 developer days
**Risk**: LOW

#### Technical Specification

**Location**: Enhance existing `/hub/(owner-admin)/tables/manage` page

**Component Enhancements**:

```typescript
// features/tables/components/TableStatusBadge.tsx

import { Badge } from '@repo/ui/components/badge';

interface TableStatusBadgeProps {
  status: TableStatus;
}

const STATUS_CONFIG: Record<TableStatus, { label: string; variant: string; color: string }> = {
  VACANT: { label: 'Vacant', variant: 'secondary', color: 'bg-gray-100' },
  SEATED: { label: 'Seated', variant: 'default', color: 'bg-blue-100' },
  ORDERING: { label: 'Ordering', variant: 'default', color: 'bg-yellow-100' },
  SERVED: { label: 'Served', variant: 'default', color: 'bg-green-100' },
  READY_TO_PAY: { label: 'Ready to Pay', variant: 'default', color: 'bg-purple-100' },
  CLEANING: { label: 'Cleaning', variant: 'destructive', color: 'bg-red-100' },
};

export function TableStatusBadge({ status }: TableStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant} className={config.color}>
      {config.label}
    </Badge>
  );
}
```

```typescript
// features/tables/components/TableCard.tsx

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@repo/ui/components/dropdown-menu';

interface TableCardProps {
  table: TableWithStatus;
  onStatusChange: (tableId: string, newStatus: TableStatus) => void;
}

export function TableCard({ table, onStatusChange }: TableCardProps) {
  const availableTransitions = TABLE_STATE_TRANSITIONS[table.currentStatus] || [];

  return (
    <Card className={cn('transition-all', getStatusColorClass(table.currentStatus))}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{table.name}</span>
          <TableStatusBadge status={table.currentStatus} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {table.activeSession && (
          <div className="text-sm text-muted-foreground">
            <p>Guests: {table.activeSession.guestCount}</p>
            <p>Session: {formatDistanceToNow(table.activeSession.createdAt)} ago</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {availableTransitions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                Change Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {availableTransitions.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onStatusChange(table.id, status)}
                >
                  {STATUS_CONFIG[status].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardFooter>
    </Card>
  );
}
```

```typescript
// app/[locale]/hub/(owner-admin)/tables/manage/page.tsx (Enhanced)

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllTablesWithStatus, updateTableStatus } from '@/features/tables/services/table.service';
import { TableCard } from '@/features/tables/components/TableCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs';

export default function TableManagePage() {
  const selectedStoreId = useAuthStore(selectSelectedStoreId);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'ALL'>('ALL');

  const { data: tables = [], isLoading } = useQuery({
    queryKey: tablesKeys.withStatus(selectedStoreId),
    queryFn: () => getAllTablesWithStatus(selectedStoreId!),
    enabled: !!selectedStoreId,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ tableId, status }: { tableId: string; status: TableStatus }) =>
      updateTableStatus(tableId, { status }),
    onSuccess: () => {
      toast.success('Table status updated');
      queryClient.invalidateQueries({ queryKey: tablesKeys.withStatus(selectedStoreId) });
    },
  });

  const filteredTables = statusFilter === 'ALL'
    ? tables
    : tables.filter((t) => t.currentStatus === statusFilter);

  // Count tables by status
  const statusCounts = tables.reduce((acc, table) => {
    acc[table.currentStatus] = (acc[table.currentStatus] || 0) + 1;
    return acc;
  }, {} as Record<TableStatus, number>);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">Table Management</h1>
        <p className="text-muted-foreground">Monitor and manage table states</p>
      </header>

      {/* Status Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as TableStatus | 'ALL')}>
        <TabsList>
          <TabsTrigger value="ALL">All ({tables.length})</TabsTrigger>
          <TabsTrigger value="VACANT">Vacant ({statusCounts.VACANT || 0})</TabsTrigger>
          <TabsTrigger value="SEATED">Seated ({statusCounts.SEATED || 0})</TabsTrigger>
          <TabsTrigger value="ORDERING">Ordering ({statusCounts.ORDERING || 0})</TabsTrigger>
          <TabsTrigger value="SERVED">Served ({statusCounts.SERVED || 0})</TabsTrigger>
          <TabsTrigger value="READY_TO_PAY">Ready to Pay ({statusCounts.READY_TO_PAY || 0})</TabsTrigger>
          <TabsTrigger value="CLEANING">Cleaning ({statusCounts.CLEANING || 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-[200px]" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onStatusChange={(tableId, status) =>
                updateStatusMutation.mutate({ tableId, status })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Testing Requirements**:

```typescript
describe('Table State Dashboard', () => {
  it('should display all tables with status badges', () => {});
  it('should filter tables by status', () => {});
  it('should update table status via dropdown', () => {});
  it('should enforce valid state transitions', () => {});
  it('should auto-refresh every 30 seconds', () => {});
});
```

**Breaking Changes**: None (enhancement to existing page)

---

## 4. Integration Points

### 4.1 Backend-Frontend API Contracts

**Critical Integration Points**:

| Feature | Backend Endpoint | Frontend Usage | Auto-Generated Type |
|---------|------------------|----------------|---------------------|
| Routing Areas | `GET /kitchen/orders?routingArea=GRILL` | KDS page filters | `OrderResponseDto` |
| Change Calculation | `POST /payments/orders/:id` (with `amountTendered`) | Payment dialog | `PaymentResponseDto` |
| Table Status | `PATCH /tables/:id/status` | Table dashboard | `TableResponseDto` |
| Manual Orders | `POST /orders/manual` | Sale page | `OrderResponseDto` |
| Payment Summary | `GET /payments/orders/:id/summary` | Order details | `PaymentSummaryDto` |
| Staff Activity | `GET /reports/staff-activity` | Reports page | `StaffActivityReportDto` |
| Bill Splitting | `POST /payments/orders/:id` (multiple calls) | Payment dialog | `PaymentResponseDto` |

**Type Generation Workflow**:

```bash
# After backend API changes
cd origin-food-house-backend
npm run build  # Generate OpenAPI spec

# Regenerate frontend types
cd ../origin-food-house-frontend
npm run generate:api  # Fetch spec and generate TypeScript types

# Verify types
npm run check-types  # Must pass with 0 errors
```

### 4.2 Real-Time Event Flows

**WebSocket Events** (Existing):

| Event | Direction | Usage | Payload |
|-------|-----------|-------|---------|
| `cart:updated` | Server → Client | SOS cart sync | `CartResponseDto` |
| `cart:add` | Client → Server | Add item | `AddToCartDto` |

**Potential New Events** (KDS Real-Time):

| Event | Direction | Usage | Payload |
|-------|-----------|-------|---------|
| `order:created` | Server → Client | KDS new order notification | `OrderResponseDto` |
| `order:status-updated` | Server → Client | KDS status change | `{ orderId, status }` |
| `table:status-updated` | Server → Client | Table dashboard | `{ tableId, status }` |

**Implementation Pattern** (Future Enhancement):

```typescript
// backend: kitchen/kitchen.gateway.ts

@WebSocketGateway()
export class KitchenGateway {
  @WebSocketServer()
  server: Server;

  emitOrderCreated(storeId: string, order: Order) {
    this.server.to(`kitchen-${storeId}`).emit('order:created', order);
  }

  emitOrderStatusUpdated(storeId: string, orderId: string, status: OrderStatus) {
    this.server.to(`kitchen-${storeId}`).emit('order:status-updated', { orderId, status });
  }
}

// frontend: features/kitchen/hooks/useKitchenSocket.ts

export function useKitchenSocket(storeId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.emit('join-kitchen', { storeId });

    socket.on('order:created', (order: OrderResponseDto) => {
      queryClient.setQueryData(
        kitchenKeys.orders(storeId),
        (old: OrderResponseDto[]) => [...(old || []), order]
      );
      toast.info(`New order: #${order.orderNumber}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [storeId]);
}
```

### 4.3 Database Transaction Boundaries

**Critical Transactional Operations**:

1. **Create Manual Order**:
```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Create order
  const order = await tx.order.create({ ... });

  // 2. Create order items
  await tx.orderItem.createMany({ ... });

  // 3. Update table status (if DINE_IN)
  if (tableId) {
    await tx.table.update({
      where: { id: tableId },
      data: { currentStatus: TableStatus.ORDERING }
    });
  }

  return order;
});
```

2. **Record Payment (Bill Splitting)**:
```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Create payment
  const payment = await tx.payment.create({ ... });

  // 2. Update order totalPaid
  const updatedOrder = await tx.order.update({
    where: { id: orderId },
    data: { totalPaid: { increment: payment.amount } }
  });

  // 3. Mark as COMPLETED if fully paid
  if (updatedOrder.totalPaid.equals(updatedOrder.grandTotal)) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.COMPLETED, paidAt: new Date() }
    });
  }

  return payment;
});
```

3. **Issue Refund**:
```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Create refund record
  const refund = await tx.refund.create({ ... });

  // 2. Update order status to CANCELLED (if full refund)
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { refunds: true } });
  const totalRefunded = order.refunds.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));

  if (totalRefunded.greaterThanOrEqualTo(order.grandTotal)) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED }
    });
  }

  return refund;
});
```

### 4.4 Authentication/Authorization Points

**RBAC Matrix**:

| Feature | OWNER | ADMIN | CHEF | CASHIER | SERVER |
|---------|-------|-------|------|---------|--------|
| Manual Order Creation | ✅ | ✅ | ❌ | ✅ | ✅ |
| Record Payment | ✅ | ✅ | ❌ | ✅ | ❌ |
| Issue Refund | ✅ | ✅ | ❌ | ✅ | ❌ |
| Cancel Order | ✅ | ✅ | ❌ | ❌ | ✅ |
| View Reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update Table Status | ✅ | ✅ | ❌ | ❌ | ✅ |
| Update KDS Order Status | ✅ | ✅ | ✅ | ❌ | ❌ |

**Implementation Pattern**:

```typescript
// Every endpoint enforces RBAC
@Post('manual')
async createManualOrder(
  @Query('storeId') storeId: string,
  @Body() dto: CreateManualOrderDto,
  @GetUser('sub') userId: string
) {
  // Service validates roles
  return this.orderService.createManualOrder(userId, storeId, dto);
}

// In service
async createManualOrder(userId: string, storeId: string, dto: CreateManualOrderDto) {
  await this.authService.checkStorePermission(
    userId,
    storeId,
    [Role.OWNER, Role.ADMIN, Role.CASHIER, Role.SERVER]
  );
  // ... proceed
}
```

---

## 5. Technical Risks & Mitigation

### 5.1 High-Risk Areas

#### 5.1.1 Bill Splitting (Payment Model Refactoring)

**Risk Level**: HIGH
**Impact**: Breaking change if not designed carefully
**Probability**: MEDIUM

**Risks**:
- Existing payment logic assumes one payment per order
- Frontend may cache payment data incorrectly
- Race conditions when multiple staff record payments simultaneously
- Decimal precision errors in split calculations

**Mitigation**:
1. **Additive Changes Only**: Add `totalPaid` cache to Order model (no breaking changes)
2. **Transaction Locking**: Use database-level locking for payment records
```typescript
await this.prisma.order.update({
  where: { id: orderId },
  data: { totalPaid: { increment: newPayment.amount } },
  // Prisma automatically handles concurrent updates
});
```
3. **Validation Layer**: Enforce `totalPaid <= grandTotal` at database level
4. **Frontend Optimistic Updates**: Disable optimistic updates for payments (consistency over speed)

**Testing Strategy**:
- Concurrent payment test: Multiple users record payments simultaneously
- Edge case: Partial payment + full payment race condition
- Decimal precision: Test with amounts like 99.99, 0.01, etc.

#### 5.1.2 State Machine Complexity (Table Status)

**Risk Level**: MEDIUM
**Impact**: Invalid state transitions could corrupt table management
**Probability**: MEDIUM

**Risks**:
- State transitions not enforced at database level
- Automatic state updates conflict with manual updates
- No rollback mechanism if transition fails mid-operation

**Mitigation**:
1. **Strict Validation**: Enforce transitions in service layer + database constraint
```typescript
if (!isValidTransition(currentStatus, newStatus)) {
  throw new BadRequestException(`Invalid transition: ${currentStatus} → ${newStatus}`);
}
```
2. **Idempotency**: Allow re-applying same status (no-op)
3. **Audit Logging**: Log all status changes with userId and reason
4. **Conflict Resolution**: Last-write-wins strategy with updatedAt timestamp

**Testing Strategy**:
- Test all valid transitions
- Test all invalid transitions (should fail)
- Test concurrent updates to same table
- Test automatic vs manual status update conflicts

#### 5.1.3 Manual Order Creation (Session-less Flow)

**Risk Level**: MEDIUM
**Impact**: Could bypass security checks if not implemented correctly
**Probability**: LOW (good patterns exist)

**Risks**:
- Manual orders skip session validation
- No cart entity for manual orders (different code path)
- Table assignment conflicts (manual order vs QR order)

**Mitigation**:
1. **Session-Optional Design**: Order model already supports `sessionId: null`
2. **Table Locking**: Check table is not in use before creating manual order
```typescript
const table = await this.prisma.table.findUnique({ where: { id: tableId } });
if (table.currentStatus === TableStatus.ORDERING || table.currentStatus === TableStatus.SERVED) {
  throw new BadRequestException('Table is currently in use');
}
```
3. **RBAC Enforcement**: Only authorized staff can create manual orders
4. **Audit Trail**: Log `createdBy` field on manual orders

**Testing Strategy**:
- Test manual order without session
- Test table conflict scenarios
- Test RBAC enforcement
- Test counter/takeaway orders (no table)

### 5.2 Medium-Risk Areas

#### 5.2.1 Real-Time KDS Updates (Future Feature)

**Risk Level**: MEDIUM
**Impact**: Performance degradation under high load
**Probability**: LOW (not implemented yet)

**Mitigation**:
- Use WebSocket rooms per store (isolate traffic)
- Implement throttling (max 10 events/second)
- Fallback to polling if WebSocket fails

#### 5.2.2 Report Generation Performance

**Risk Level**: MEDIUM
**Impact**: Slow queries on large datasets
**Probability**: MEDIUM

**Mitigation**:
- Add database indexes for report queries
```sql
CREATE INDEX idx_order_store_created ON "Order"("storeId", "createdAt" DESC);
CREATE INDEX idx_payment_order_created ON "Payment"("orderId", "createdAt");
```
- Implement pagination for large result sets
- Cache report results (5-minute TTL)
- Offload heavy queries to read replica (future)

### 5.3 Low-Risk Areas

- QR Code Generation: Already implemented, production-ready
- Routing Areas: Simple enum addition, low complexity
- Change Calculation: Single field addition, well-defined logic

### 5.4 Performance Considerations

**Database Query Optimization**:

| Feature | Optimization | Impact |
|---------|--------------|--------|
| KDS Routing Filter | Add index on `MenuItem.routingArea` | 50% query speed improvement |
| Table Status Dashboard | Add index on `Table.currentStatus` | 3x faster filtering |
| Reports Date Range | Add composite index `(storeId, createdAt)` | 10x faster aggregations |
| Payment Summary | Use `totalPaid` cache vs SUM query | 100x faster (no JOIN) |

**Frontend Caching Strategy**:

```typescript
// React Query configuration for reports
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes for reports
      cacheTime: 30 * 60 * 1000, // 30 minutes
    },
  },
});

// Aggressive caching for static data
useQuery({
  queryKey: menuKeys.categories(storeId),
  queryFn: () => getCategories(storeId),
  staleTime: 60 * 60 * 1000, // 1 hour (menu changes infrequently)
});
```

**Bundle Size Optimization**:

- QR code generation: Already using `qrcode.react` (17KB gzipped) ✅
- Charts: Use `recharts` (included in @repo/ui) ✅
- Date pickers: Use `date-fns` (already installed) ✅
- Avoid heavy libraries (moment.js, lodash-full)

---

## 6. Implementation Sequence

### Phase 1: Critical Foundations (Week 1)

**Goal**: Establish core backend infrastructure

**Backend Tasks** (3 days):
1. **Day 1**: Routing Areas + Preparation Times
   - Add schema fields
   - Create migration
   - Update DTOs and services
   - Write tests (85%+ coverage)

2. **Day 2**: Change Calculation + Bill Splitting
   - Add `amountTendered` field
   - Implement payment validation
   - Update payment service for multi-payment
   - Write tests

3. **Day 3**: Table State Management
   - Add `TableStatus` enum and field
   - Implement state transition logic
   - Hook into session/order events
   - Write tests

**Quality Gates**:
- ✅ All migrations applied successfully
- ✅ All tests passing (257+ tests)
- ✅ Lint passes (0 warnings)
- ✅ Build succeeds
- ✅ OpenAPI spec regenerated

### Phase 2: Frontend Core Features (Week 2)

**Goal**: Implement high-priority user-facing features

**Frontend Tasks** (5 days):
1. **Day 1-2**: Manual Order Creation (RMS)
   - Build order entry components
   - Implement Zustand store
   - Connect to backend APIs
   - Add translations (4 languages)

2. **Day 3**: Payment Recording UI (RMS)
   - Build payment dialog
   - Implement change calculation
   - Add payment summary card
   - Write component tests

3. **Day 4**: Refund/Void UI (RMS)
   - Build refund dialog
   - Build cancel order dialog
   - Connect to backend APIs
   - Add audit logging

4. **Day 5**: Table State Dashboard (RMS)
   - Enhance table management page
   - Add status filter tabs
   - Implement status badges
   - Add auto-refresh

**Quality Gates**:
- ✅ Type check passes (0 errors)
- ✅ Lint passes (0 warnings)
- ✅ Component tests written
- ✅ Translations added for all 4 languages
- ✅ Build succeeds

### Phase 3: Reports & Analytics (Week 3)

**Goal**: Business intelligence features

**Tasks** (5 days):
1. **Day 1**: Staff Activity Report (Backend)
   - Implement report service
   - Add RBAC enforcement
   - Write tests

2. **Day 2-4**: Reports Dashboard (Frontend)
   - Build date range picker
   - Implement 5 report cards
   - Add charts (using @repo/ui)
   - Optimize query performance

3. **Day 5**: Integration Testing
   - Test full report workflow
   - Performance testing (large datasets)
   - RBAC validation

**Quality Gates**:
- ✅ All reports load < 2 seconds
- ✅ RBAC enforced (OWNER/ADMIN only)
- ✅ Charts render correctly
- ✅ Date filtering works

### Phase 4: Polish & Testing (Week 4)

**Goal**: Production readiness

**Tasks** (3 days):
1. **Day 1**: Integration Testing
   - Test full order lifecycle (manual → payment → refund)
   - Test table state transitions
   - Test bill splitting scenarios

2. **Day 2**: Performance Optimization
   - Add database indexes
   - Optimize queries
   - Bundle size analysis

3. **Day 3**: Documentation & Deployment
   - Update API docs
   - Update user guides
   - Prepare for deployment

**Quality Gates**:
- ✅ All integration tests passing
- ✅ Performance benchmarks met
- ✅ Documentation updated
- ✅ Ready for production

### Parallel Development Opportunities

**Backend & Frontend can work simultaneously**:

| Week | Backend Focus | Frontend Focus |
|------|---------------|----------------|
| 1 | Schema changes, API endpoints | UI component library preparation |
| 2 | Testing, optimization | Manual order creation, payment UI |
| 3 | Reports backend | Reports dashboard |
| 4 | Bug fixes | Integration testing |

**Team Structure**:
- **Backend Developer**: Focus on schema, services, tests
- **Frontend Developer 1**: Manual order creation, payment UI
- **Frontend Developer 2**: Reports dashboard, table management
- **QA Engineer**: Integration testing, RBAC validation

### Dependencies & Sequencing

**Must Complete First** (Blockers):
1. Backend schema changes → Frontend type generation
2. Payment multi-payment support → Bill splitting UI
3. Table status enum → Table dashboard

**Can Parallelize**:
- Manual order creation UI (independent)
- Reports backend + Reports frontend (parallel)
- Refund UI (after payment backend complete)

---

## 7. Quality Gates & Testing Strategy

### 7.1 Backend Testing Requirements

**Coverage Targets**:
- Critical modules: 85%+ (consistent with existing standards)
- New features: 80%+ minimum
- Edge cases: 100% (payment calculations, state transitions)

**Test Suites** (Add to existing 257 tests):

```typescript
// payment/payment.service.spec.ts (Add ~15 tests)

describe('PaymentService - Bill Splitting', () => {
  it('should allow multiple partial payments', async () => {});
  it('should reject payment exceeding remaining balance', async () => {});
  it('should calculate change for cash payments', async () => {});
  it('should mark order COMPLETED when fully paid', async () => {});
  it('should use Decimal precision', async () => {});
});

// table/table.service.spec.ts (Add ~12 tests)

describe('TableService - State Management', () => {
  it('should validate state transitions', async () => {});
  it('should reject invalid transitions', async () => {});
  it('should update automatically on session events', async () => {});
  it('should enforce RBAC', async () => {});
});

// order/order.service.spec.ts (Add ~10 tests)

describe('OrderService - Manual Orders', () => {
  it('should create order without session', async () => {});
  it('should validate table availability', async () => {});
  it('should handle counter/takeaway orders', async () => {});
});

// report/report.service.spec.ts (Add ~8 tests)

describe('ReportService - Staff Activity', () => {
  it('should return activity for all staff', async () => {});
  it('should filter by date range', async () => {});
  it('should enforce OWNER/ADMIN RBAC', async () => {});
});
```

**Expected Test Count**:
- Current: 257 tests
- Add: ~45 new tests
- **Total: 302 tests**

### 7.2 Frontend Testing Requirements

**Coverage Targets**:
- New pages: 70%+ (RMS standard)
- Critical business logic: 85%+ (payment calculations)
- UI components: 60%+ (component behavior)

**Test Suites** (Add to existing ~94 tests):

```typescript
// Manual Order Creation (~12 tests)
describe('ManualOrderPage', () => {
  it('should select order type', () => {});
  it('should add items to order', () => {});
  it('should calculate totals correctly', () => {});
  it('should create order via API', () => {});
});

// Payment Recording (~8 tests)
describe('RecordPaymentDialog', () => {
  it('should calculate change for cash', () => {});
  it('should validate tendered amount', () => {});
  it('should record payment', () => {});
});

// Reports Dashboard (~10 tests)
describe('ReportsPage', () => {
  it('should load all reports in parallel', () => {});
  it('should filter by date range', () => {});
  it('should display charts', () => {});
});

// Table State Dashboard (~6 tests)
describe('TableManagePage', () => {
  it('should display table status badges', () => {});
  it('should filter by status', () => {});
  it('should update status', () => {});
});
```

**Expected Test Count**:
- Current: ~94 tests (RMS)
- Add: ~36 new tests
- **Total: ~130 tests (RMS)**

### 7.3 Integration Testing

**End-to-End Scenarios**:

1. **Manual Order Flow**:
```gherkin
Given a staff member is logged in
When they create a manual order for Table 5
And add 2 items with customizations
And record a cash payment with change
Then the order should be COMPLETED
And the table status should be CLEANING
```

2. **Bill Splitting Flow**:
```gherkin
Given an order with grand total $100
When Customer A pays $40 cash
And Customer B pays $60 card
Then the order should be COMPLETED
And payment summary should show 2 payments
```

3. **Refund Flow**:
```gherkin
Given a COMPLETED order
When staff issues a $50 refund
Then a refund record should be created
And the refund should be logged with reason
```

**Integration Test Tools**:
- Backend E2E: Supertest + Jest
- Frontend E2E: Playwright (future, not in MVP)

### 7.4 Performance Testing

**Benchmarks**:

| Metric | Target | Test Method |
|--------|--------|-------------|
| Payment record latency | < 200ms | Load test with 100 concurrent requests |
| Reports generation | < 2s | Query with 10,000 orders |
| Table status update | < 100ms | Websocket latency test |
| Manual order creation | < 500ms | Create order with 10 items |

**Load Testing** (Optional, Post-MVP):

```bash
# Artillery load test config
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10 # 10 requests/second
scenarios:
  - name: Record Payment
    flow:
      - post:
          url: '/payments/orders/{{ orderId }}'
          json:
            amount: '50.00'
            paymentMethod: 'CASH'
```

### 7.5 Security Testing

**Security Checklist**:

- ✅ RBAC enforced on all new endpoints
- ✅ Input validation on all DTOs
- ✅ SQL injection prevention (Prisma parameterized queries)
- ✅ XSS prevention (React auto-escaping)
- ✅ CSRF protection (httpOnly cookies)
- ✅ Store isolation (all queries filter by storeId)

**RBAC Test Matrix**:

```typescript
describe('Authorization', () => {
  it('should allow OWNER to create manual order', async () => {});
  it('should deny CHEF from creating manual order', async () => {});
  it('should allow CASHIER to record payment', async () => {});
  it('should deny SERVER from issuing refund', async () => {});
  it('should allow ADMIN to view reports', async () => {});
  it('should deny CHEF from viewing reports', async () => {});
});
```

### 7.6 Regression Testing

**Ensure No Breaking Changes**:

1. **Existing Cart Flow** (SOS):
   - QR code scan → session join → add to cart → checkout
   - Payment recording (existing flow)

2. **Existing KDS Flow** (RMS):
   - Order appears on KDS
   - Status updates (PENDING → PREPARING → READY → SERVED)

3. **Existing Menu Management**:
   - Create/edit categories
   - Create/edit menu items with customizations

**Regression Test Suite**:
- Run full existing test suite (257 tests backend, 94 tests frontend)
- All tests must pass before merging new features

---

## 8. Appendix: Detailed Specifications

### 8.1 Database Indexes (Performance Optimization)

**Add to migration**:

```sql
-- Routing Areas
CREATE INDEX idx_menu_item_routing_area ON "MenuItem"("routingArea");

-- Table Status
CREATE INDEX idx_table_status ON "Table"("storeId", "currentStatus");

-- Order Date Range Queries
CREATE INDEX idx_order_created_desc ON "Order"("storeId", "createdAt" DESC);

-- Payment Queries
CREATE INDEX idx_payment_order_created ON "Payment"("orderId", "createdAt");

-- Refund Queries
CREATE INDEX idx_refund_order_created ON "Refund"("orderId", "createdAt");
```

### 8.2 API Endpoint Summary (New)

**Backend Endpoints to Add**:

| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| POST | `/orders/manual` | Create order without session | OWNER, ADMIN, CASHIER, SERVER |
| PATCH | `/orders/:id/cancel` | Cancel order with reason | OWNER, ADMIN, SERVER |
| GET | `/payments/orders/:id/summary` | Get payment summary | OWNER, ADMIN, CASHIER, SERVER |
| PATCH | `/tables/:id/status` | Update table status | OWNER, ADMIN, SERVER |
| GET | `/reports/staff-activity` | Staff activity report | OWNER, ADMIN |
| GET | `/kitchen/orders?routingArea=GRILL` | Filter KDS by routing area | OWNER, ADMIN, CHEF |

**Frontend Routes to Add**:

| Route | Page | Access |
|-------|------|--------|
| `/hub/sale` | Manual Order Creation | OWNER, ADMIN, CASHIER, SERVER |
| `/hub/(owner-admin)/reports` | Reports Dashboard | OWNER, ADMIN |
| `/hub/(owner-admin)/tables/manage` | Table State Dashboard (enhanced) | OWNER, ADMIN |

### 8.3 Environment Variables (No New Required)

All features use existing environment variables:

- ✅ `DATABASE_URL`: PostgreSQL connection
- ✅ `JWT_SECRET`: Authentication
- ✅ `NEXT_PUBLIC_API_URL`: Frontend API calls
- ✅ `NEXT_PUBLIC_CUSTOMER_APP_URL`: QR code URLs

**No new environment variables required**.

### 8.4 Third-Party Dependencies (No New Required)

All features use existing dependencies:

**Backend**:
- ✅ Prisma (ORM)
- ✅ NestJS (framework)
- ✅ class-validator (validation)

**Frontend**:
- ✅ qrcode.react (QR codes) - already installed
- ✅ react-to-print (printing) - already installed
- ✅ recharts (charts) - included in @repo/ui
- ✅ date-fns (date handling) - already installed
- ✅ Decimal.js (currency) - already installed in SOS

**No new dependencies required**.

### 8.5 i18n Translation Keys to Add

**RMS Translations** (add to all 4 languages):

```json
// en.json (English)
{
  "sales": {
    "manualOrder": "Manual Order",
    "selectOrderType": "Select Order Type",
    "dineIn": "Dine In",
    "takeaway": "Takeaway",
    "selectTable": "Select Table",
    "addItems": "Add Items",
    "orderSummary": "Order Summary",
    "createOrder": "Create Order",
    "paymentMethod": "Payment Method",
    "amountTendered": "Amount Tendered",
    "change": "Change",
    "recordPayment": "Record Payment",
    "paymentRecorded": "Payment recorded successfully",
    "refund": "Refund",
    "issueRefund": "Issue Refund",
    "refundReason": "Refund Reason",
    "cancelOrder": "Cancel Order",
    "cancelReason": "Cancellation Reason"
  },
  "reports": {
    "title": "Reports & Analytics",
    "salesSummary": "Sales Summary",
    "topItems": "Top Selling Items",
    "paymentBreakdown": "Payment Breakdown",
    "orderStatus": "Order Status",
    "staffActivity": "Staff Activity",
    "dateRange": "Date Range",
    "today": "Today",
    "thisWeek": "This Week",
    "thisMonth": "This Month",
    "last30Days": "Last 30 Days",
    "customRange": "Custom Range"
  },
  "tables": {
    "status": {
      "vacant": "Vacant",
      "seated": "Seated",
      "ordering": "Ordering",
      "served": "Served",
      "readyToPay": "Ready to Pay",
      "cleaning": "Cleaning"
    },
    "changeStatus": "Change Status",
    "statusUpdated": "Table status updated"
  }
}

// zh.json (Chinese)
{
  "sales": {
    "manualOrder": "手动订单",
    "selectOrderType": "选择订单类型",
    "dineIn": "堂食",
    "takeaway": "外卖",
    // ... etc
  }
}

// my.json (Myanmar)
{
  "sales": {
    "manualOrder": "လက်ဖြင့်မှာယူမှု",
    // ... etc
  }
}

// th.json (Thai)
{
  "sales": {
    "manualOrder": "สั่งซื้อด้วยตนเอง",
    // ... etc
  }
}
```

**Estimated Translation Keys**: ~80 new keys × 4 languages = **320 translations**

### 8.6 Shared Components from @repo/ui (Reuse Checklist)

**Components to Use** (Already Available):

- ✅ Button (variants: default, outline, destructive, secondary)
- ✅ Card (CardHeader, CardTitle, CardContent, CardFooter)
- ✅ Dialog (DialogContent, DialogHeader, DialogTitle, DialogFooter)
- ✅ Input (type="number", type="text")
- ✅ Textarea
- ✅ Select (SelectTrigger, SelectValue, SelectContent, SelectItem)
- ✅ RadioGroup / ToggleGroup
- ✅ Alert (AlertTitle, AlertDescription)
- ✅ Badge (variants: default, secondary, destructive)
- ✅ Table (TableHeader, TableBody, TableRow, TableCell)
- ✅ Tabs (TabsList, TabsTrigger, TabsContent)
- ✅ Skeleton
- ✅ Calendar (for date range picker)
- ✅ Popover (for date picker dropdown)
- ✅ Chart (ChartContainer, ChartTooltip) - Recharts wrapper
- ✅ DropdownMenu (for table status actions)

**Do NOT Create**:
- ❌ Custom button components
- ❌ Custom dialog components
- ❌ Custom form inputs
- ❌ Custom table components

**Only Create**:
- ✅ Feature-specific components (OrderItemCard, TableCard, etc.)
- ✅ Business logic components (OrderSummary, PaymentSummary)

---

## Conclusion

This technical implementation plan provides a **comprehensive roadmap** to complete Release Slice A, addressing the 25% gap identified in the business analyst's review.

**Key Takeaways**:

1. **Critical Blocker Resolved**: QR Code UI is already implemented and production-ready
2. **Minimal Backend Changes**: 15% effort (schema additions, no breaking changes)
3. **Significant Frontend Work**: 50% effort (new pages and complex workflows)
4. **Clear Implementation Path**: Phased approach over 3-4 weeks
5. **Risk Mitigation**: Comprehensive testing and validation strategy
6. **Type Safety**: Auto-generated types ensure frontend-backend contract
7. **Quality Standards**: 85%+ test coverage, RBAC enforcement, Decimal precision

**Success Metrics**:

- ✅ All 14 missing features implemented
- ✅ 100% RBAC coverage on new endpoints
- ✅ Zero breaking changes to existing functionality
- ✅ 302 total backend tests passing
- ✅ ~130 total frontend tests passing
- ✅ Performance benchmarks met
- ✅ Production deployment ready

**Next Steps**:

1. Review this plan with stakeholders
2. Assign tasks to development teams
3. Begin Phase 1 (backend foundations)
4. Run `npm run generate:api` after backend changes
5. Execute frontend development in parallel
6. Continuous integration testing
7. Deploy to production

---

**Document End**
