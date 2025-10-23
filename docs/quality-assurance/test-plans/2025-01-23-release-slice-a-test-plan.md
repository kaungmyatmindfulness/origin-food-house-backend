# Release Slice A - Comprehensive Test Plan

**Date**: January 23, 2025
**Agent**: QA Engineer
**Scope**: Core Operations (Release Slice A)
**Test Type**: Unit, Integration, E2E, Security, Performance
**Status**: Ready for Execution

---

## Executive Summary

**Overall Completion**: 75% (Backend 85%, Frontend 50%)

**Critical Testing Focus**:
1. **QR Code Generation UI** (CRITICAL BLOCKER) - Must be tested first
2. **Bill Splitting** (HIGH RISK) - Complex financial logic
3. **Payment Recording with Change Calculation** (HIGH RISK) - Financial accuracy
4. **Manual Order Creation** (HIGH PRIORITY) - Core POS functionality
5. **Table State Management** (MEDIUM RISK) - State consistency

**Test Environment**:
- Backend: NestJS API v11, PostgreSQL, Prisma ORM
- Frontend RMS: Next.js 15 (Port 3002)
- Frontend SOS: Next.js 15 (Port 3001)
- Test Coverage Target: 85%+ on critical modules

**Current Test Status**:
- Backend: 257 tests passing, critical modules 85%+ coverage
- Frontend RMS: 7 widget tests, <5% business logic coverage
- Frontend SOS: 0% coverage (CRITICAL GAP)

---

## Test Strategy Definition

### 1. Unit Test Strategy (Backend Services)

**Objective**: Validate individual service methods in isolation with mocked dependencies.

**Coverage Target**: 85%+ on all new and modified modules

**Approach**:
- Mock Prisma client using `createPrismaMock()` helper
- Test business logic independently from database
- Validate error handling and edge cases
- Test Decimal precision for financial calculations
- Test RBAC permission checks

**Priority Modules**:
1. Table Service (QR code generation logic)
2. Payment Service (change calculation)
3. Order Service (bill splitting, void/refund)
4. Active Table Session Service (table state management)
5. Kitchen Service (routing area filtering)

---

### 2. Integration Test Strategy (API Endpoints)

**Objective**: Validate API endpoints with real database interactions.

**Coverage Target**: All new endpoints and modified workflows

**Approach**:
- Use test database (reset between suites)
- Test full request-response cycle
- Validate DTO validation and transformations
- Test RBAC guards on protected routes
- Test multi-tenant isolation
- Test transaction rollback scenarios

**Test Database Setup**:
```typescript
beforeAll(async () => {
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  await prisma.$migrate.deploy();
});

afterEach(async () => {
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany();
  // ... cleanup
});
```

---

### 3. Component Test Strategy (Frontend Components)

**Objective**: Validate UI components render correctly and handle user interactions.

**Coverage Target**: All new UI features

**Approach**:
- Jest + React Testing Library
- Mock API calls with MSW (Mock Service Worker)
- Test user interactions (clicks, form submissions)
- Test loading states and error handling
- Test accessibility (keyboard navigation, screen readers)

**Testing Pattern**:
```typescript
describe('QRCodeGenerationWidget', () => {
  it('renders QR code for table', async () => {
    render(<QRCodeGenerationWidget tableId="123" />);
    expect(await screen.findByRole('img')).toBeInTheDocument();
  });

  it('downloads QR code as PNG', async () => {
    const { user } = setup(<QRCodeGenerationWidget />);
    await user.click(screen.getByText('Download'));
    expect(mockDownload).toHaveBeenCalledWith('table-123-qr.png');
  });
});
```

---

### 4. E2E Test Strategy (User Flows)

**Objective**: Validate complete user journeys across frontend and backend.

**Coverage Target**: Critical user flows

**Approach**:
- Playwright for browser automation
- Test realistic user scenarios
- Test multi-device synchronization (SOS)
- Test real-time updates (WebSocket)
- Test cross-browser compatibility

**Critical Flows to Test**:
1. QR Scan → Menu Browse → Cart → Checkout → Payment
2. Manual Order Creation → Payment → Receipt
3. Order Placement → Bill Split → Multiple Payments → Close Session
4. Order Lifecycle → KDS Routing → Status Updates → Completion
5. Refund/Void Authorization → Processing → Receipt

---

### 5. Performance Test Strategy

**Objective**: Ensure system meets performance SLAs under load.

**Performance Benchmarks**:
- API Response Time (p95): <200ms for GET, <500ms for POST
- WebSocket Latency: <1000ms
- Database Query Time: <100ms (simple), <500ms (complex)
- Report Generation: <2s for 1000 orders
- QR Code Generation: <100ms per code

**Load Testing Scenarios**:
- 50 concurrent table sessions
- 100 orders per minute
- 20 KDS stations polling simultaneously
- 1000+ order report generation

**Tools**: Artillery, k6, or Locust for load testing

---

## Backend Test Scenarios

### Feature: Routing Areas for KDS

**Priority**: HIGH (Blocker for efficient kitchen operations)

**User Story**: As a chef, I want orders routed to my specific station (Grill, Fry, Salad, etc.) so I only see relevant orders.

#### Unit Tests - MenuItem Service

```gherkin
Scenario: Create menu item with routing area
  Given I am an OWNER of Store A
  When I create a menu item "Burger" with routingArea = "GRILL"
  Then the menu item should be created with routingArea = "GRILL"
  And the item should be queryable by routing area

Scenario: Update menu item routing area
  Given a menu item "Fries" exists with routingArea = "FRY"
  When I update the routing area to "GRILL"
  Then the routing area should be updated
  And the change should be reflected in KDS queries

Scenario: Query menu items by routing area
  Given menu items exist:
    | Name     | Routing Area |
    | Burger   | GRILL        |
    | Fries    | FRY          |
    | Salad    | SALAD        |
  When I query for GRILL items
  Then only "Burger" should be returned

Scenario: Validation - Invalid routing area
  Given I am creating a menu item
  When I provide routingArea = "INVALID"
  Then I should receive a BadRequestException
  And the error message should indicate valid routing areas
```

**Test Implementation**:
```typescript
describe('MenuService - Routing Areas', () => {
  let service: MenuService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prismaMock = createPrismaMock();
    service = new MenuService(prismaMock, authService, s3Service, logger);
  });

  describe('createMenuItem with routing area', () => {
    it('should create item with valid routing area', async () => {
      const dto: CreateMenuItemDto = {
        name: 'Burger',
        basePrice: '12.99',
        routingArea: RoutingArea.GRILL,
        categoryId: 'cat-1'
      };

      prismaMock.menuItem.create.mockResolvedValue({
        id: 'item-1',
        ...dto,
        basePrice: new Decimal('12.99'),
        storeId: 'store-1',
        routingArea: RoutingArea.GRILL
      });

      const result = await service.createMenuItem('user-1', 'store-1', dto);

      expect(result.routingArea).toBe(RoutingArea.GRILL);
      expect(prismaMock.menuItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          routingArea: RoutingArea.GRILL
        })
      });
    });

    it('should reject invalid routing area', async () => {
      const dto = {
        name: 'Burger',
        basePrice: '12.99',
        routingArea: 'INVALID' as any
      };

      await expect(
        service.createMenuItem('user-1', 'store-1', dto)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findMenuItemsByRoutingArea', () => {
    it('should filter items by routing area', async () => {
      const grillItems = [
        { id: '1', name: 'Burger', routingArea: RoutingArea.GRILL },
        { id: '2', name: 'Steak', routingArea: RoutingArea.GRILL }
      ];

      prismaMock.menuItem.findMany.mockResolvedValue(grillItems);

      const result = await service.findMenuItemsByRoutingArea(
        'store-1',
        RoutingArea.GRILL
      );

      expect(result).toHaveLength(2);
      expect(prismaMock.menuItem.findMany).toHaveBeenCalledWith({
        where: {
          storeId: 'store-1',
          routingArea: RoutingArea.GRILL,
          deletedAt: null
        }
      });
    });
  });
});
```

#### Integration Tests - KDS Endpoints

```gherkin
Scenario: Get orders filtered by routing area
  Given orders exist with items from multiple routing areas:
    | Order ID | Items                          |
    | order-1  | Burger (GRILL), Fries (FRY)   |
    | order-2  | Salad (SALAD)                  |
    | order-3  | Steak (GRILL)                  |
  When I GET /kitchen/orders?storeId=store-1&routingArea=GRILL
  Then I should receive orders: order-1, order-3
  And each order should only show items with routingArea = GRILL

Scenario: RBAC - Only CHEF/ADMIN/OWNER can access KDS
  Given I am authenticated as CASHIER
  When I GET /kitchen/orders?storeId=store-1&routingArea=GRILL
  Then I should receive 403 Forbidden

Scenario: Multi-tenant isolation - Cannot see other stores
  Given orders exist for Store A and Store B
  When I GET /kitchen/orders?storeId=store-a&routingArea=GRILL
  Then I should only receive Store A orders
  And Store B orders should not be visible
```

**Test Implementation**:
```typescript
describe('KitchenController - Routing Areas (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  describe('GET /kitchen/orders?routingArea=GRILL', () => {
    it('should filter orders by routing area', async () => {
      // Seed test data
      const store = await createTestStore();
      const table = await createTestTable(store.id);
      const grillItem = await createTestMenuItem(store.id, {
        routingArea: RoutingArea.GRILL
      });
      const fryItem = await createTestMenuItem(store.id, {
        routingArea: RoutingArea.FRY
      });

      const order = await createTestOrder(store.id, table.id, [
        { menuItemId: grillItem.id, quantity: 1 },
        { menuItemId: fryItem.id, quantity: 1 }
      ]);

      const token = await getAuthToken('chef', store.id);

      const response = await request(app.getHttpServer())
        .get(`/kitchen/orders?storeId=${store.id}&routingArea=GRILL`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(order.id);
      expect(response.body.data[0].items).toHaveLength(1);
      expect(response.body.data[0].items[0].menuItemId).toBe(grillItem.id);
    });

    it('should enforce RBAC - reject CASHIER role', async () => {
      const store = await createTestStore();
      const token = await getAuthToken('cashier', store.id);

      await request(app.getHttpServer())
        .get(`/kitchen/orders?storeId=${store.id}&routingArea=GRILL`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should enforce store isolation', async () => {
      const storeA = await createTestStore();
      const storeB = await createTestStore();

      const orderA = await createTestOrder(storeA.id);
      const orderB = await createTestOrder(storeB.id);

      const token = await getAuthToken('chef', storeA.id);

      const response = await request(app.getHttpServer())
        .get(`/kitchen/orders?storeId=${storeA.id}&routingArea=GRILL`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const orderIds = response.body.data.map(o => o.id);
      expect(orderIds).toContain(orderA.id);
      expect(orderIds).not.toContain(orderB.id);
    });
  });
});
```

---

### Feature: Change Calculation for Cash Payments

**Priority**: HIGH (Core POS functionality)

**User Story**: As a cashier, I want the system to calculate change automatically so I can quickly complete cash transactions.

#### Unit Tests - Payment Service

```gherkin
Scenario: Calculate change for cash payment
  Given an order with grandTotal = $50.00
  When I record a cash payment with amountTendered = $60.00
  Then change should be calculated as $10.00
  And payment.change should be $10.00
  And payment.amount should be $50.00

Scenario: Exact amount tendered - No change
  Given an order with grandTotal = $50.00
  When I record a cash payment with amountTendered = $50.00
  Then change should be $0.00

Scenario: Insufficient amount tendered
  Given an order with grandTotal = $50.00
  When I record a cash payment with amountTendered = $40.00
  Then I should receive a BadRequestException
  And the error message should be "Insufficient amount tendered"

Scenario: Decimal precision for change calculation
  Given an order with grandTotal = $27.93
  When I record a cash payment with amountTendered = $30.00
  Then change should be $2.07
  And the calculation should use Decimal type (no float errors)

Scenario: Non-cash payment - No change calculation
  Given an order with grandTotal = $50.00
  When I record a CREDIT_CARD payment
  Then amountTendered should be null
  And change should be null
```

**Test Implementation**:
```typescript
describe('PaymentService - Change Calculation', () => {
  let service: PaymentService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prismaMock = createPrismaMock();
    service = new PaymentService(prismaMock, authService, logger);
  });

  describe('recordPayment with cash', () => {
    it('should calculate change correctly', async () => {
      const order = {
        id: 'order-1',
        storeId: 'store-1',
        grandTotal: new Decimal('50.00'),
        status: OrderStatus.READY
      };

      prismaMock.order.findUnique.mockResolvedValue(order);
      prismaMock.payment.create.mockImplementation((args) =>
        Promise.resolve({ id: 'payment-1', ...args.data })
      );

      const dto: RecordPaymentDto = {
        paymentMethod: PaymentMethod.CASH,
        amountTendered: '60.00'
      };

      const result = await service.recordPayment('user-1', 'order-1', dto);

      expect(result.amount.toString()).toBe('50.00');
      expect(result.amountTendered.toString()).toBe('60.00');
      expect(result.change.toString()).toBe('10.00');
    });

    it('should handle exact amount (no change)', async () => {
      const order = {
        id: 'order-1',
        storeId: 'store-1',
        grandTotal: new Decimal('50.00'),
        status: OrderStatus.READY
      };

      prismaMock.order.findUnique.mockResolvedValue(order);
      prismaMock.payment.create.mockImplementation((args) =>
        Promise.resolve({ id: 'payment-1', ...args.data })
      );

      const dto: RecordPaymentDto = {
        paymentMethod: PaymentMethod.CASH,
        amountTendered: '50.00'
      };

      const result = await service.recordPayment('user-1', 'order-1', dto);

      expect(result.change.toString()).toBe('0.00');
    });

    it('should reject insufficient amount', async () => {
      const order = {
        id: 'order-1',
        storeId: 'store-1',
        grandTotal: new Decimal('50.00'),
        status: OrderStatus.READY
      };

      prismaMock.order.findUnique.mockResolvedValue(order);

      const dto: RecordPaymentDto = {
        paymentMethod: PaymentMethod.CASH,
        amountTendered: '40.00'
      };

      await expect(
        service.recordPayment('user-1', 'order-1', dto)
      ).rejects.toThrow(BadRequestException);
    });

    it('should use Decimal precision (avoid float errors)', async () => {
      const order = {
        id: 'order-1',
        storeId: 'store-1',
        grandTotal: new Decimal('27.93'), // 7 items × $3.99
        status: OrderStatus.READY
      };

      prismaMock.order.findUnique.mockResolvedValue(order);
      prismaMock.payment.create.mockImplementation((args) =>
        Promise.resolve({ id: 'payment-1', ...args.data })
      );

      const dto: RecordPaymentDto = {
        paymentMethod: PaymentMethod.CASH,
        amountTendered: '30.00'
      };

      const result = await service.recordPayment('user-1', 'order-1', dto);

      expect(result.change.toString()).toBe('2.07');
      // Verify no float precision errors (e.g., 2.0699999999)
      expect(result.change).toBeInstanceOf(Decimal);
    });

    it('should not calculate change for non-cash payments', async () => {
      const order = {
        id: 'order-1',
        storeId: 'store-1',
        grandTotal: new Decimal('50.00'),
        status: OrderStatus.READY
      };

      prismaMock.order.findUnique.mockResolvedValue(order);
      prismaMock.payment.create.mockImplementation((args) =>
        Promise.resolve({ id: 'payment-1', ...args.data })
      );

      const dto: RecordPaymentDto = {
        paymentMethod: PaymentMethod.CREDIT_CARD
      };

      const result = await service.recordPayment('user-1', 'order-1', dto);

      expect(result.amountTendered).toBeNull();
      expect(result.change).toBeNull();
    });
  });
});
```

#### Integration Tests - Payment Endpoints

```gherkin
Scenario: Record cash payment with change via API
  Given an order exists with grandTotal = $50.00
  When I POST /payments/orders/:orderId with:
    """
    {
      "paymentMethod": "CASH",
      "amountTendered": "60.00"
    }
    """
  Then I should receive 201 Created
  And response should contain:
    """
    {
      "amount": "50.00",
      "amountTendered": "60.00",
      "change": "10.00"
    }
    """

Scenario: Validation - Missing amountTendered for cash
  Given an order exists
  When I POST /payments/orders/:orderId with:
    """
    {
      "paymentMethod": "CASH"
    }
    """
  Then I should receive 400 Bad Request
  And error message should be "Amount tendered required for cash payments"

Scenario: RBAC - Only CASHIER/ADMIN/OWNER can record payments
  Given I am authenticated as SERVER
  When I POST /payments/orders/:orderId
  Then I should receive 403 Forbidden
```

---

### Feature: Table State Management

**Priority**: HIGH (Critical for floor management)

**User Story**: As a floor manager, I want to see table states (Vacant, Seated, Ordering, etc.) so I can manage seating efficiently.

#### Unit Tests - Table Service

```gherkin
Scenario: Update table state to SEATED
  Given a table exists with currentStatus = VACANT
  When I update the table status to SEATED
  Then currentStatus should be SEATED
  And updatedAt should be updated

Scenario: State transition validation - Invalid sequence
  Given a table with currentStatus = VACANT
  When I attempt to transition to READY_TO_PAY
  Then I should receive a BadRequestException
  And error message should indicate invalid transition

Scenario: Valid state transitions
  Given a table with currentStatus = VACANT
  Then I can transition to: SEATED

  Given a table with currentStatus = SEATED
  Then I can transition to: ORDERING, VACANT (cancelled)

  Given a table with currentStatus = ORDERING
  Then I can transition to: SERVED

  Given a table with currentStatus = SERVED
  Then I can transition to: READY_TO_PAY

  Given a table with currentStatus = READY_TO_PAY
  Then I can transition to: CLEANING

  Given a table with currentStatus = CLEANING
  Then I can transition to: VACANT

Scenario: Automatic state transition on session close
  Given a table has an active session
  And currentStatus = READY_TO_PAY
  When the session is closed (payment completed)
  Then table status should automatically transition to CLEANING
```

**Test Implementation**:
```typescript
describe('TableService - State Management', () => {
  let service: TableService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prismaMock = createPrismaMock();
    service = new TableService(prismaMock, authService, logger);
  });

  describe('updateTableStatus', () => {
    it('should update table status to SEATED', async () => {
      const table = {
        id: 'table-1',
        storeId: 'store-1',
        currentStatus: TableStatus.VACANT
      };

      prismaMock.table.findUnique.mockResolvedValue(table);
      prismaMock.table.update.mockResolvedValue({
        ...table,
        currentStatus: TableStatus.SEATED
      });

      const result = await service.updateTableStatus(
        'user-1',
        'table-1',
        TableStatus.SEATED
      );

      expect(result.currentStatus).toBe(TableStatus.SEATED);
    });

    it('should reject invalid state transitions', async () => {
      const table = {
        id: 'table-1',
        storeId: 'store-1',
        currentStatus: TableStatus.VACANT
      };

      prismaMock.table.findUnique.mockResolvedValue(table);

      await expect(
        service.updateTableStatus('user-1', 'table-1', TableStatus.READY_TO_PAY)
      ).rejects.toThrow(BadRequestException);
    });

    const validTransitions = [
      { from: TableStatus.VACANT, to: TableStatus.SEATED },
      { from: TableStatus.SEATED, to: TableStatus.ORDERING },
      { from: TableStatus.ORDERING, to: TableStatus.SERVED },
      { from: TableStatus.SERVED, to: TableStatus.READY_TO_PAY },
      { from: TableStatus.READY_TO_PAY, to: TableStatus.CLEANING },
      { from: TableStatus.CLEANING, to: TableStatus.VACANT }
    ];

    validTransitions.forEach(({ from, to }) => {
      it(`should allow transition: ${from} → ${to}`, async () => {
        const table = {
          id: 'table-1',
          storeId: 'store-1',
          currentStatus: from
        };

        prismaMock.table.findUnique.mockResolvedValue(table);
        prismaMock.table.update.mockResolvedValue({
          ...table,
          currentStatus: to
        });

        const result = await service.updateTableStatus('user-1', 'table-1', to);

        expect(result.currentStatus).toBe(to);
      });
    });
  });

  describe('auto state transitions', () => {
    it('should transition to CLEANING on session close', async () => {
      const session = {
        id: 'session-1',
        tableId: 'table-1',
        status: 'ACTIVE'
      };

      const table = {
        id: 'table-1',
        currentStatus: TableStatus.READY_TO_PAY
      };

      prismaMock.activeTableSession.findUnique.mockResolvedValue(session);
      prismaMock.table.findUnique.mockResolvedValue(table);
      prismaMock.table.update.mockResolvedValue({
        ...table,
        currentStatus: TableStatus.CLEANING
      });

      await service.closeSession('session-1');

      expect(prismaMock.table.update).toHaveBeenCalledWith({
        where: { id: 'table-1' },
        data: { currentStatus: TableStatus.CLEANING }
      });
    });
  });
});
```

---

## Frontend Test Scenarios

### Feature: QR Code Generation UI (CRITICAL BLOCKER)

**Priority**: CRITICAL (Blocker for table ordering deployment)

**User Story**: As a restaurant owner, I want to generate and print QR codes for my tables so customers can scan and order.

#### Component Tests - QR Code Widget

```gherkin
Scenario: Render QR code for table
  Given I am on the Tables management page
  And a table "Table 1" exists with ID "table-123"
  When the page loads
  Then I should see a QR code for "Table 1"
  And the QR code should encode URL: "{SOS_URL}/tables/table-123/join"

Scenario: Download QR code as PNG
  Given I am viewing a table's QR code
  When I click the "Download QR" button
  Then a PNG file should be downloaded
  And the filename should be "table-{tableName}-qr.png"
  And the image should be 512x512 pixels

Scenario: Print QR code
  Given I am viewing a table's QR code
  When I click the "Print" button
  Then the browser print dialog should open
  And the QR code should be print-optimized (high resolution)

Scenario: Regenerate QR code
  Given a table has an existing QR code
  When I click "Regenerate QR"
  Then a new QR code should be generated
  And the new QR code should contain the same table ID
  And the QR code display should update

Scenario: Bulk print all QR codes
  Given I have 10 tables in my store
  When I click "Print All QR Codes"
  Then a print layout with all 10 QR codes should open
  And each QR code should be labeled with table name
  And QR codes should be arranged in a grid (2 columns)

Scenario: QR code displays table name and store name
  Given a table "Table 5" in store "Downtown Bistro"
  When I view the QR code
  Then I should see "Downtown Bistro" text
  And I should see "Table 5" text
  And the text should be positioned below the QR code

Scenario: Error handling - Failed QR generation
  Given QR code generation fails (API error)
  When I load the Tables page
  Then I should see an error message
  And the error should say "Failed to generate QR code"
  And a "Retry" button should be available

Scenario: Loading states
  Given QR codes are being generated
  When the page is loading
  Then I should see skeleton loaders for each table
  And a "Generating QR codes..." message should display
```

**Test Implementation**:
```typescript
// apps/restaurant-management-system/__tests__/components/QRCodeGenerationWidget.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QRCodeGenerationWidget } from '@/components/tables/QRCodeGenerationWidget';
import { server } from '@/mocks/server';
import { rest } from 'msw';

describe('QRCodeGenerationWidget', () => {
  const mockTable = {
    id: 'table-123',
    name: 'Table 1',
    storeId: 'store-1',
    qrCodeUrl: null
  };

  beforeEach(() => {
    // Mock QR code generation API
    server.use(
      rest.post('/api/tables/:id/qr-code', (req, res, ctx) => {
        return res(
          ctx.json({
            data: {
              qrCodeUrl: 'http://localhost:3001/tables/table-123/join'
            }
          })
        );
      })
    );
  });

  it('renders QR code for table', async () => {
    render(<QRCodeGenerationWidget table={mockTable} />);

    // QR code should be rendered
    const qrCode = await screen.findByRole('img', { name: /qr code/i });
    expect(qrCode).toBeInTheDocument();
    expect(qrCode).toHaveAttribute('alt', 'QR Code for Table 1');
  });

  it('displays table name and store name', async () => {
    const store = { name: 'Downtown Bistro' };
    render(<QRCodeGenerationWidget table={mockTable} store={store} />);

    expect(await screen.findByText('Downtown Bistro')).toBeInTheDocument();
    expect(screen.getByText('Table 1')).toBeInTheDocument();
  });

  it('downloads QR code as PNG', async () => {
    const user = userEvent.setup();
    const mockDownload = jest.fn();
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

    // Mock anchor click
    const mockAnchor = document.createElement('a');
    mockAnchor.click = mockDownload;
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

    render(<QRCodeGenerationWidget table={mockTable} />);

    const downloadButton = await screen.findByRole('button', { name: /download/i });
    await user.click(downloadButton);

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalled();
      expect(mockAnchor.download).toBe('table-Table 1-qr.png');
    });
  });

  it('triggers print dialog', async () => {
    const user = userEvent.setup();
    const mockPrint = jest.fn();
    window.print = mockPrint;

    render(<QRCodeGenerationWidget table={mockTable} />);

    const printButton = await screen.findByRole('button', { name: /print/i });
    await user.click(printButton);

    expect(mockPrint).toHaveBeenCalled();
  });

  it('regenerates QR code on button click', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      rest.post('/api/tables/:id/qr-code', (req, res, ctx) => {
        callCount++;
        return res(
          ctx.json({
            data: {
              qrCodeUrl: `http://localhost:3001/tables/table-123/join?v=${callCount}`
            }
          })
        );
      })
    );

    render(<QRCodeGenerationWidget table={mockTable} />);

    const regenerateButton = await screen.findByRole('button', {
      name: /regenerate/i
    });
    await user.click(regenerateButton);

    await waitFor(() => {
      expect(callCount).toBe(2); // Initial + regenerate
    });
  });

  it('handles QR generation error gracefully', async () => {
    server.use(
      rest.post('/api/tables/:id/qr-code', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'QR generation failed' }));
      })
    );

    render(<QRCodeGenerationWidget table={mockTable} />);

    const errorMessage = await screen.findByText(/failed to generate qr code/i);
    expect(errorMessage).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('shows loading state while generating', async () => {
    server.use(
      rest.post('/api/tables/:id/qr-code', (req, res, ctx) => {
        return res(ctx.delay(1000), ctx.json({ data: { qrCodeUrl: 'url' } }));
      })
    );

    render(<QRCodeGenerationWidget table={mockTable} />);

    expect(screen.getByText(/generating qr code/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner

    await waitFor(() => {
      expect(screen.queryByText(/generating/i)).not.toBeInTheDocument();
    });
  });
});

describe('BulkQRCodePrint', () => {
  const mockTables = Array.from({ length: 10 }, (_, i) => ({
    id: `table-${i + 1}`,
    name: `Table ${i + 1}`,
    storeId: 'store-1'
  }));

  it('renders all table QR codes in print layout', async () => {
    render(<BulkQRCodePrint tables={mockTables} />);

    for (const table of mockTables) {
      expect(await screen.findByText(table.name)).toBeInTheDocument();
    }
  });

  it('triggers print dialog for bulk print', async () => {
    const user = userEvent.setup();
    const mockPrint = jest.fn();
    window.print = mockPrint;

    render(<BulkQRCodePrint tables={mockTables} />);

    const printAllButton = await screen.findByRole('button', {
      name: /print all/i
    });
    await user.click(printAllButton);

    expect(mockPrint).toHaveBeenCalled();
  });

  it('arranges QR codes in 2-column grid', async () => {
    const { container } = render(<BulkQRCodePrint tables={mockTables} />);

    const grid = container.querySelector('.qr-grid');
    expect(grid).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)'
    });
  });
});
```

#### E2E Tests - QR Code Flow

```gherkin
Scenario: End-to-end QR code generation and scanning
  Given I am logged in as OWNER
  When I navigate to "/hub/tables"
  And I create a new table "Table 1"
  Then I should see a QR code displayed

  When I download the QR code
  Then a PNG file should be saved to my Downloads folder

  When a customer scans the QR code
  Then they should be redirected to "{SOS_URL}/tables/{tableId}/join"
  And a new session should be created
  And the customer should see the menu
```

**Playwright Test**:
```typescript
// apps/restaurant-management-system/e2e/qr-code-generation.spec.ts

import { test, expect } from '@playwright/test';

test.describe('QR Code Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as OWNER
    await page.goto('http://localhost:3002/auth/login');
    await page.fill('[name="email"]', 'owner@test.com');
    await page.fill('[name="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/hub/dashboard');
  });

  test('should generate QR code for new table', async ({ page }) => {
    await page.goto('http://localhost:3002/hub/tables');

    // Create new table
    await page.click('button:has-text("Add Table")');
    await page.fill('[name="name"]', 'Table 1');
    await page.fill('[name="capacity"]', '4');
    await page.click('button:has-text("Create")');

    // Wait for QR code to render
    const qrCode = page.locator('img[alt*="QR Code"]').first();
    await expect(qrCode).toBeVisible();
  });

  test('should download QR code as PNG', async ({ page }) => {
    await page.goto('http://localhost:3002/hub/tables');

    // Start download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download QR")').first();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/table-.*-qr\.png/);

    // Verify file was downloaded
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('should print QR code', async ({ page, context }) => {
    await page.goto('http://localhost:3002/hub/tables');

    // Mock print dialog
    let printTriggered = false;
    await context.route('**/*', route => route.continue());
    page.on('dialog', () => { printTriggered = true; });

    await page.evaluate(() => {
      window.print = () => {
        window.dispatchEvent(new Event('beforeprint'));
      };
    });

    await page.click('button:has-text("Print")').first();

    // Give time for print to trigger
    await page.waitForTimeout(500);

    // Note: Actual print dialog testing is limited in Playwright
    // This verifies the print function was called
  });

  test('should bulk print all QR codes', async ({ page }) => {
    await page.goto('http://localhost:3002/hub/tables');

    // Create multiple tables first
    for (let i = 1; i <= 3; i++) {
      await page.click('button:has-text("Add Table")');
      await page.fill('[name="name"]', `Table ${i}`);
      await page.fill('[name="capacity"]', '4');
      await page.click('button:has-text("Create")');
      await page.waitForTimeout(500);
    }

    // Trigger bulk print
    await page.click('button:has-text("Print All QR Codes")');

    // Verify print layout contains all tables
    const printContent = page.locator('.qr-print-layout');
    await expect(printContent).toBeVisible();

    for (let i = 1; i <= 3; i++) {
      await expect(printContent.locator(`text=Table ${i}`)).toBeVisible();
    }
  });

  test('customer scans QR code and joins session', async ({ page, context }) => {
    // Setup: Create table and get QR URL
    await page.goto('http://localhost:3002/hub/tables');
    await page.click('button:has-text("Add Table")');
    await page.fill('[name="name"]', 'Table 1');
    await page.click('button:has-text("Create")');

    // Extract QR code URL
    const qrCodeUrl = await page.locator('[data-qr-url]').first().getAttribute('data-qr-url');
    expect(qrCodeUrl).toContain('/tables/');

    // Customer scans QR code (open in new page)
    const customerPage = await context.newPage();
    await customerPage.goto(qrCodeUrl);

    // Verify customer is on SOS app
    await expect(customerPage).toHaveURL(/.*tables\/.*\/join/);

    // Verify session created and menu displayed
    await expect(customerPage.locator('h1:has-text("Menu")')).toBeVisible();
  });
});
```

---

### Feature: Manual Order Creation (RMS)

**Priority**: HIGH (Core POS functionality)

**User Story**: As a cashier, I want to create orders manually for phone orders and walk-in customers so I don't need to rely on customer QR scans.

#### Component Tests - Manual Order Form

```gherkin
Scenario: Create counter order without table
  Given I am on the Sale page
  When I click "New Order"
  And I select "Counter Order" as order type
  And I add menu items to the order
  And I click "Submit Order"
  Then an order should be created with tableId = null
  And orderType should be "COUNTER"

Scenario: Create takeout order
  Given I am creating a new order
  When I select "Takeout" as order type
  And I add menu items
  And I enter customer phone number
  And I submit the order
  Then an order should be created with orderType = "TAKEOUT"
  And customer contact should be saved

Scenario: Add items with customizations
  Given I am creating a manual order
  When I add "Burger" to the order
  And I select customization "Add Cheese"
  And I select customization "Remove Onions"
  Then the order should include customizations
  And the price should reflect customization charges

Scenario: Validation - Cannot submit empty order
  Given I am creating a new order
  When I click "Submit Order" without adding items
  Then I should see a validation error
  And the error should say "At least one item required"

Scenario: Handle API errors gracefully
  Given I am creating an order
  And the API is unavailable
  When I click "Submit Order"
  Then I should see an error message
  And the error should say "Failed to create order. Please try again."
  And the order form should remain filled (not reset)

Scenario: Cancel order creation
  Given I am creating a new order
  And I have added items
  When I click "Cancel"
  Then a confirmation dialog should appear
  And if I confirm, the form should reset
  And I should return to the orders list
```

**Test Implementation**:
```typescript
// apps/restaurant-management-system/__tests__/components/ManualOrderForm.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManualOrderForm } from '@/components/sale/ManualOrderForm';
import { server } from '@/mocks/server';
import { rest } from 'msw';

describe('ManualOrderForm', () => {
  const mockMenuItems = [
    { id: 'item-1', name: 'Burger', basePrice: '12.99' },
    { id: 'item-2', name: 'Fries', basePrice: '4.99' }
  ];

  beforeEach(() => {
    server.use(
      rest.get('/api/menu/items', (req, res, ctx) => {
        return res(ctx.json({ data: mockMenuItems }));
      }),
      rest.post('/api/orders', (req, res, ctx) => {
        return res(ctx.json({ data: { id: 'order-1', status: 'PENDING' } }));
      })
    );
  });

  it('creates counter order without table', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();

    render(<ManualOrderForm onSuccess={onSuccess} />);

    // Select order type
    await user.click(screen.getByLabelText(/order type/i));
    await user.click(screen.getByRole('option', { name: /counter/i }));

    // Add items
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByText('Burger'));

    // Submit
    await user.click(screen.getByRole('button', { name: /submit order/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'order-1',
          orderType: 'COUNTER',
          tableId: null
        })
      );
    });
  });

  it('creates takeout order with customer info', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();

    server.use(
      rest.post('/api/orders', async (req, res, ctx) => {
        const body = await req.json();
        expect(body.orderType).toBe('TAKEOUT');
        expect(body.customerPhone).toBe('555-1234');
        return res(ctx.json({ data: { id: 'order-1' } }));
      })
    );

    render(<ManualOrderForm onSuccess={onSuccess} />);

    // Select takeout
    await user.click(screen.getByLabelText(/order type/i));
    await user.click(screen.getByRole('option', { name: /takeout/i }));

    // Enter customer phone
    await user.type(screen.getByLabelText(/customer phone/i), '555-1234');

    // Add items
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByText('Burger'));

    // Submit
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('adds items with customizations', async () => {
    const user = userEvent.setup();

    const mockItemWithCustomizations = {
      ...mockMenuItems[0],
      customizationGroups: [
        {
          id: 'group-1',
          name: 'Additions',
          options: [
            { id: 'opt-1', name: 'Add Cheese', price: '1.00' },
            { id: 'opt-2', name: 'Add Bacon', price: '2.00' }
          ]
        }
      ]
    };

    server.use(
      rest.get('/api/menu/items/:id', (req, res, ctx) => {
        return res(ctx.json({ data: mockItemWithCustomizations }));
      })
    );

    render(<ManualOrderForm />);

    // Add item
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByText('Burger'));

    // Select customizations
    await user.click(screen.getByLabelText(/add cheese/i));
    await user.click(screen.getByLabelText(/add bacon/i));

    // Verify price calculation
    expect(screen.getByText(/\$15.99/)).toBeInTheDocument(); // $12.99 + $1 + $2
  });

  it('validates empty order submission', async () => {
    const user = userEvent.setup();

    render(<ManualOrderForm />);

    // Try to submit without items
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(screen.getByText(/at least one item required/i)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/orders', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Server error' }));
      })
    );

    render(<ManualOrderForm />);

    // Add item and submit
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByText('Burger'));
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Error message displayed
    await waitFor(() => {
      expect(
        screen.getByText(/failed to create order/i)
      ).toBeInTheDocument();
    });

    // Form still contains items (not reset)
    expect(screen.getByText('Burger')).toBeInTheDocument();
  });

  it('confirms before cancelling order', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();

    // Mock window.confirm
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ManualOrderForm onCancel={onCancel} />);

    // Add item
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByText('Burger'));

    // Click cancel
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('discard')
    );
    expect(onCancel).toHaveBeenCalled();
  });
});
```

---

### Feature: Bill Splitting (HIGH RISK)

**Priority**: HIGH (Complex financial logic)

**User Story**: As a server, I want to split bills among diners so groups can pay separately.

#### Unit Tests - Order Service (Bill Splitting Logic)

```gherkin
Scenario: Split order equally (2 ways)
  Given an order with grandTotal = $100.00
  When I split the bill equally 2 ways
  Then 2 payment allocations should be created
  And each allocation should be $50.00

Scenario: Split order by items
  Given an order with items:
    | Item   | Price  | Quantity | Total   |
    | Burger | $12.00 | 2        | $24.00  |
    | Fries  | $4.00  | 1        | $4.00   |
    | Drink  | $3.00  | 3        | $9.00   |
  When I split by items:
    | Diner | Items          |
    | A     | Burger × 1     |
    | B     | Burger × 1, Fries × 1, Drink × 1 |
    | C     | Drink × 2      |
  Then allocation for Diner A should be $12.00
  And allocation for Diner B should be $20.00
  And allocation for Diner C should be $6.00
  And total of allocations should equal grandTotal

Scenario: Split with VAT and service charge
  Given an order:
    | Subtotal       | $100.00 |
    | Service Charge | $10.00  |
    | VAT (7%)       | $7.70   |
    | Grand Total    | $117.70 |
  When I split equally 2 ways
  Then each allocation should be $58.85
  And VAT/service charge should be proportionally distributed

Scenario: Validation - All items must be allocated
  Given an order with 3 items
  When I create a split with only 2 items allocated
  Then I should receive a BadRequestException
  And error should say "All items must be allocated"

Scenario: Validation - No double allocation
  Given an order with item "Burger" quantity 1
  When I attempt to allocate "Burger" to 2 different diners
  Then I should receive a BadRequestException
  And error should say "Item already allocated"

Scenario: Record payments for split bills
  Given an order split 3 ways:
    | Diner | Amount  |
    | A     | $30.00  |
    | B     | $40.00  |
    | C     | $30.00  |
  When I record payment for Diner A ($30 cash)
  And I record payment for Diner B ($40 card)
  And I record payment for Diner C ($30 cash)
  Then order.paidAmount should be $100.00
  And order should be marked as COMPLETED
```

**Test Implementation**:
```typescript
describe('OrderService - Bill Splitting', () => {
  let service: OrderService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prismaMock = createPrismaMock();
    service = new OrderService(prismaMock, authService, logger);
  });

  describe('splitOrderEqually', () => {
    it('should split order equally 2 ways', async () => {
      const order = {
        id: 'order-1',
        storeId: 'store-1',
        grandTotal: new Decimal('100.00'),
        status: OrderStatus.READY
      };

      prismaMock.order.findUnique.mockResolvedValue(order);
      prismaMock.billSplit.create.mockResolvedValue({
        id: 'split-1',
        orderId: 'order-1',
        numberOfSplits: 2
      });

      const mockTransaction = {
        order: prismaMock.order,
        billSplit: prismaMock.billSplit,
        splitAllocation: {
          createMany: jest.fn().mockResolvedValue({ count: 2 })
        }
      };

      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback(mockTransaction)
      );

      const result = await service.splitOrderEqually('user-1', 'order-1', 2);

      expect(result.numberOfSplits).toBe(2);
      expect(mockTransaction.splitAllocation.createMany).toHaveBeenCalledWith({
        data: [
          { billSplitId: 'split-1', amount: new Decimal('50.00'), dinerNumber: 1 },
          { billSplitId: 'split-1', amount: new Decimal('50.00'), dinerNumber: 2 }
        ]
      });
    });

    it('should use Decimal precision (avoid float errors)', async () => {
      const order = {
        id: 'order-1',
        grandTotal: new Decimal('100.00')
      };

      prismaMock.order.findUnique.mockResolvedValue(order);

      const mockTransaction = {
        order: prismaMock.order,
        billSplit: { create: jest.fn().mockResolvedValue({ id: 'split-1' }) },
        splitAllocation: { createMany: jest.fn() }
      };

      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback(mockTransaction)
      );

      await service.splitOrderEqually('user-1', 'order-1', 3);

      const calls = mockTransaction.splitAllocation.createMany.mock.calls[0][0];
      const amounts = calls.data.map(d => d.amount);

      // Each split should be $33.33 (with potential $0.01 adjustment)
      expect(amounts[0]).toBeInstanceOf(Decimal);
      expect(amounts.reduce((sum, amt) => sum.plus(amt), new Decimal(0)).toString())
        .toBe('100.00');
    });
  });

  describe('splitOrderByItems', () => {
    it('should split order by item allocation', async () => {
      const order = {
        id: 'order-1',
        items: [
          {
            id: 'item-1',
            menuItemId: 'burger',
            quantity: 2,
            subtotal: new Decimal('24.00')
          },
          {
            id: 'item-2',
            menuItemId: 'fries',
            quantity: 1,
            subtotal: new Decimal('4.00')
          }
        ],
        grandTotal: new Decimal('28.00')
      };

      const splitDto: SplitByItemsDto = {
        allocations: [
          { dinerNumber: 1, orderItemIds: ['item-1'] }, // $24
          { dinerNumber: 2, orderItemIds: ['item-2'] }  // $4
        ]
      };

      prismaMock.order.findUnique.mockResolvedValue(order);

      const result = await service.splitOrderByItems('user-1', 'order-1', splitDto);

      // Verify allocations
      expect(result.allocations).toHaveLength(2);
      expect(result.allocations[0].amount.toString()).toBe('24.00');
      expect(result.allocations[1].amount.toString()).toBe('4.00');
    });

    it('should validate all items are allocated', async () => {
      const order = {
        id: 'order-1',
        items: [
          { id: 'item-1', subtotal: new Decimal('10.00') },
          { id: 'item-2', subtotal: new Decimal('5.00') },
          { id: 'item-3', subtotal: new Decimal('3.00') }
        ]
      };

      const splitDto: SplitByItemsDto = {
        allocations: [
          { dinerNumber: 1, orderItemIds: ['item-1', 'item-2'] }
          // Missing item-3
        ]
      };

      prismaMock.order.findUnique.mockResolvedValue(order);

      await expect(
        service.splitOrderByItems('user-1', 'order-1', splitDto)
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent double allocation', async () => {
      const order = {
        id: 'order-1',
        items: [
          { id: 'item-1', quantity: 1, subtotal: new Decimal('10.00') }
        ]
      };

      const splitDto: SplitByItemsDto = {
        allocations: [
          { dinerNumber: 1, orderItemIds: ['item-1'] },
          { dinerNumber: 2, orderItemIds: ['item-1'] } // Duplicate
        ]
      };

      prismaMock.order.findUnique.mockResolvedValue(order);

      await expect(
        service.splitOrderByItems('user-1', 'order-1', splitDto)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordSplitPayment', () => {
    it('should record payment for split allocation', async () => {
      const billSplit = {
        id: 'split-1',
        orderId: 'order-1',
        allocations: [
          { id: 'alloc-1', dinerNumber: 1, amount: new Decimal('30.00'), isPaid: false },
          { id: 'alloc-2', dinerNumber: 2, amount: new Decimal('40.00'), isPaid: false }
        ]
      };

      prismaMock.billSplit.findUnique.mockResolvedValue(billSplit);

      const paymentDto: RecordSplitPaymentDto = {
        allocationId: 'alloc-1',
        paymentMethod: PaymentMethod.CASH,
        amountTendered: '30.00'
      };

      const mockTransaction = {
        payment: {
          create: jest.fn().mockResolvedValue({ id: 'payment-1', amount: new Decimal('30.00') })
        },
        splitAllocation: {
          update: jest.fn().mockResolvedValue({ ...billSplit.allocations[0], isPaid: true })
        }
      };

      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback(mockTransaction)
      );

      const result = await service.recordSplitPayment('user-1', 'split-1', paymentDto);

      expect(result.isPaid).toBe(true);
      expect(mockTransaction.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: new Decimal('30.00'),
          paymentMethod: PaymentMethod.CASH
        })
      });
    });

    it('should mark order COMPLETED when all splits paid', async () => {
      const billSplit = {
        id: 'split-1',
        orderId: 'order-1',
        allocations: [
          { id: 'alloc-1', amount: new Decimal('30.00'), isPaid: true },
          { id: 'alloc-2', amount: new Decimal('30.00'), isPaid: false } // Last unpaid
        ]
      };

      prismaMock.billSplit.findUnique.mockResolvedValue(billSplit);

      const mockTransaction = {
        payment: { create: jest.fn().mockResolvedValue({ id: 'payment-2' }) },
        splitAllocation: {
          update: jest.fn().mockResolvedValue({ ...billSplit.allocations[1], isPaid: true })
        },
        order: {
          update: jest.fn().mockResolvedValue({ id: 'order-1', status: OrderStatus.COMPLETED })
        }
      };

      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback(mockTransaction)
      );

      await service.recordSplitPayment('user-1', 'split-1', {
        allocationId: 'alloc-2',
        paymentMethod: PaymentMethod.CASH,
        amountTendered: '30.00'
      });

      expect(mockTransaction.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.COMPLETED }
      });
    });
  });
});
```

#### Frontend Tests - Bill Splitting UI

```gherkin
Scenario: Split bill equally
  Given I am viewing an order with total $100.00
  When I click "Split Bill"
  And I select "Split Equally"
  And I enter "2" for number of splits
  Then I should see 2 payment sections
  And each section should show amount $50.00

Scenario: Split bill by items
  Given an order has items:
    | Item   | Price |
    | Burger | $12   |
    | Fries  | $4    |
    | Drink  | $3    |
  When I click "Split Bill"
  And I select "Split by Items"
  And I assign "Burger" to Diner 1
  And I assign "Fries, Drink" to Diner 2
  Then Diner 1 should owe $12.00
  And Diner 2 should owe $7.00
  And total should equal $19.00

Scenario: Prevent incomplete splits
  Given I am splitting an order with 3 items
  When I assign only 2 items to diners
  And I click "Confirm Split"
  Then I should see a validation error
  And error should say "All items must be assigned"

Scenario: Record payments for each split
  Given an order is split 3 ways
  When I record payment for Diner 1 (cash $30)
  Then Diner 1 should be marked "Paid"

  When I record payment for Diner 2 (card $40)
  Then Diner 2 should be marked "Paid"

  When I record payment for Diner 3 (cash $30)
  Then all diners should be marked "Paid"
  And the order should be marked "Completed"

Scenario: Cancel split operation
  Given I am in the middle of splitting a bill
  When I click "Cancel"
  Then I should return to the order details
  And no split should be created
```

**Test Implementation**:
```typescript
// apps/restaurant-management-system/__tests__/components/BillSplitDialog.test.tsx

describe('BillSplitDialog', () => {
  const mockOrder = {
    id: 'order-1',
    grandTotal: '100.00',
    items: [
      { id: 'item-1', name: 'Burger', price: '12.00', quantity: 2 },
      { id: 'item-2', name: 'Fries', price: '4.00', quantity: 1 }
    ]
  };

  it('splits bill equally', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();

    render(<BillSplitDialog order={mockOrder} onSuccess={onSuccess} />);

    // Select split method
    await user.click(screen.getByLabelText(/split method/i));
    await user.click(screen.getByRole('option', { name: /equally/i }));

    // Enter number of splits
    await user.type(screen.getByLabelText(/number of diners/i), '2');

    // Confirm
    await user.click(screen.getByRole('button', { name: /confirm split/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          numberOfSplits: 2,
          allocations: expect.arrayContaining([
            expect.objectContaining({ amount: '50.00' }),
            expect.objectContaining({ amount: '50.00' })
          ])
        })
      );
    });
  });

  it('splits bill by items', async () => {
    const user = userEvent.setup();

    render(<BillSplitDialog order={mockOrder} />);

    await user.click(screen.getByLabelText(/split method/i));
    await user.click(screen.getByRole('option', { name: /by items/i }));

    // Assign items
    await user.click(screen.getByText('Burger')); // Opens assignment
    await user.click(screen.getByText('Assign to Diner 1'));

    await user.click(screen.getByText('Fries'));
    await user.click(screen.getByText('Assign to Diner 2'));

    // Verify amounts
    expect(screen.getByText('Diner 1: $24.00')).toBeInTheDocument();
    expect(screen.getByText('Diner 2: $4.00')).toBeInTheDocument();
  });

  it('validates all items assigned', async () => {
    const user = userEvent.setup();

    render(<BillSplitDialog order={mockOrder} />);

    await user.click(screen.getByLabelText(/split method/i));
    await user.click(screen.getByRole('option', { name: /by items/i }));

    // Assign only one item (incomplete)
    await user.click(screen.getByText('Burger'));
    await user.click(screen.getByText('Assign to Diner 1'));

    // Try to confirm
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(screen.getByText(/all items must be assigned/i)).toBeInTheDocument();
  });

  it('records payments for each split', async () => {
    const user = userEvent.setup();

    const mockSplit = {
      id: 'split-1',
      allocations: [
        { id: 'alloc-1', dinerNumber: 1, amount: '50.00', isPaid: false },
        { id: 'alloc-2', dinerNumber: 2, amount: '50.00', isPaid: false }
      ]
    };

    server.use(
      rest.post('/api/orders/:id/split', (req, res, ctx) => {
        return res(ctx.json({ data: mockSplit }));
      }),
      rest.post('/api/bill-splits/:id/payments', async (req, res, ctx) => {
        const body = await req.json();
        return res(ctx.json({
          data: {
            id: 'payment-1',
            allocationId: body.allocationId,
            isPaid: true
          }
        }));
      })
    );

    render(<BillSplitPaymentView splitId="split-1" />);

    // Pay for Diner 1
    await user.click(screen.getByRole('button', { name: /pay diner 1/i }));
    await user.click(screen.getByLabelText(/cash/i));
    await user.click(screen.getByRole('button', { name: /confirm payment/i }));

    await waitFor(() => {
      expect(screen.getByText(/diner 1.*paid/i)).toBeInTheDocument();
    });
  });
});
```

---

## Integration Test Scenarios

### E2E Flow: QR Scan → Order → Payment

**Scenario**: Complete customer journey from QR scan to payment

```gherkin
Given a restaurant "Downtown Bistro" with table "Table 5"
And the table has a QR code generated
And menu items exist:
  | Name    | Price  |
  | Burger  | $12.00 |
  | Fries   | $4.00  |
  | Coke    | $3.00  |

When a customer scans the QR code
Then they should be redirected to SOS app
And a new session should be created for Table 5

When the customer browses the menu
And adds "Burger" to cart
And adds "Fries" to cart
And adds "Coke" to cart
Then the cart should show 3 items
And the cart total should be $19.00

When the customer clicks "Checkout"
Then an order should be created with status PENDING
And the order should appear on KDS

When a chef marks the order as PREPARING
Then the order status should update in real-time on customer's device

When a chef marks the order as READY
And a server marks the order as SERVED
Then the customer should see "Ready to Pay"

When the customer requests the bill
And a cashier records payment (cash $20.00)
Then change should be calculated as $1.00
And the order should be marked COMPLETED
And the table session should be closed
And the table status should update to CLEANING
```

**Playwright E2E Test**:
```typescript
// e2e/complete-order-flow.spec.ts

test('complete customer order flow', async ({ page, context }) => {
  // Setup: Create store, table, menu
  const store = await createTestStore('Downtown Bistro');
  const table = await createTestTable(store.id, 'Table 5');
  const burger = await createMenuItem(store.id, 'Burger', '12.00');
  const fries = await createMenuItem(store.id, 'Fries', '4.00');
  const coke = await createMenuItem(store.id, 'Coke', '3.00');

  // Generate QR code
  const qrUrl = `http://localhost:3001/tables/${table.id}/join`;

  // Customer scans QR
  await page.goto(qrUrl);
  await expect(page).toHaveURL(/tables\/.*\/join/);

  // Browse menu
  await expect(page.locator('h1:has-text("Menu")')).toBeVisible();

  // Add items to cart
  await page.click(`[data-item-id="${burger.id}"] button:has-text("Add")`);
  await page.click(`[data-item-id="${fries.id}"] button:has-text("Add")`);
  await page.click(`[data-item-id="${coke.id}"] button:has-text("Add")`);

  // Verify cart
  const cartBadge = page.locator('[data-cart-badge]');
  await expect(cartBadge).toHaveText('3');

  await page.click('button:has-text("View Cart")');
  await expect(page.locator('[data-cart-total]')).toHaveText('$19.00');

  // Checkout
  await page.click('button:has-text("Checkout")');
  await page.click('button:has-text("Confirm Order")');

  // Wait for order confirmation
  await expect(page.locator('text=Order Placed')).toBeVisible();

  // Open KDS in new tab (chef view)
  const kdsPage = await context.newPage();
  await kdsPage.goto('http://localhost:3002/hub/kitchen');

  const orderCard = kdsPage.locator(`[data-order-id]`).first();
  await expect(orderCard).toBeVisible();
  await expect(orderCard).toContainText('Table 5');

  // Mark as preparing
  await orderCard.locator('button:has-text("Start Cooking")').click();

  // Verify real-time update on customer page
  await page.waitForTimeout(1000); // Wait for WebSocket
  await expect(page.locator('text=Preparing')).toBeVisible();

  // Mark as ready
  await orderCard.locator('button:has-text("Mark Ready")').click();
  await page.waitForTimeout(1000);
  await expect(page.locator('text=Ready')).toBeVisible();

  // Server marks as served
  const orderId = await orderCard.getAttribute('data-order-id');
  await kdsPage.goto(`http://localhost:3002/hub/orders/${orderId}`);
  await kdsPage.click('button:has-text("Mark Served")');

  // Customer sees ready to pay
  await page.waitForTimeout(1000);
  await expect(page.locator('text=Ready to Pay')).toBeVisible();

  // Cashier records payment
  const cashierPage = await context.newPage();
  await cashierPage.goto(`http://localhost:3002/hub/orders/${orderId}`);
  await cashierPage.click('button:has-text("Record Payment")');

  await cashierPage.click('input[value="CASH"]');
  await cashierPage.fill('[name="amountTendered"]', '20.00');

  await expect(cashierPage.locator('[data-change]')).toHaveText('$1.00');

  await cashierPage.click('button:has-text("Confirm Payment")');

  // Verify completion
  await expect(cashierPage.locator('text=Payment Recorded')).toBeVisible();

  // Verify customer sees completion
  await page.waitForTimeout(1000);
  await expect(page.locator('text=Thank You')).toBeVisible();
});
```

---

## Security Test Scenarios

### Multi-Tenant Isolation

```gherkin
Scenario: Prevent cross-store data access
  Given Store A with ID "store-a"
  And Store B with ID "store-b"
  And I am authenticated as OWNER of Store A

  When I GET /menu/items?storeId=store-b
  Then I should receive 403 Forbidden

  When I POST /menu/items with storeId=store-b
  Then I should receive 403 Forbidden

  When I GET /orders?storeId=store-b
  Then I should receive 403 Forbidden

Scenario: Prevent cart manipulation across sessions
  Given Session A for Table 1
  And Session B for Table 2
  And Session A has sessionToken "token-a"

  When I POST /carts/session-b/items with header "x-session-token: token-a"
  Then I should receive 403 Forbidden

  When I DELETE /carts/session-b/items/123 with header "x-session-token: token-a"
  Then I should receive 403 Forbidden

Scenario: RBAC enforcement on payment operations
  Given I am authenticated as SERVER (not CASHIER)
  When I POST /payments/orders/:orderId
  Then I should receive 403 Forbidden

  Given I am authenticated as CASHIER
  When I POST /payments/orders/:orderId
  Then I should receive 201 Created
```

**Test Implementation**:
```typescript
describe('Security - Multi-Tenant Isolation', () => {
  let app: INestApplication;

  it('prevents cross-store menu access', async () => {
    const storeA = await createTestStore();
    const storeB = await createTestStore();

    const tokenStoreA = await getAuthToken('owner', storeA.id);

    // Attempt to access Store B's data with Store A token
    await request(app.getHttpServer())
      .get(`/menu/items?storeId=${storeB.id}`)
      .set('Authorization', `Bearer ${tokenStoreA}`)
      .expect(403);
  });

  it('prevents cross-session cart manipulation', async () => {
    const sessionA = await createTestSession('table-1');
    const sessionB = await createTestSession('table-2');

    // Attempt to add to Session B cart with Session A token
    await request(app.getHttpServer())
      .post(`/carts/${sessionB.id}/items`)
      .set('x-session-token', sessionA.sessionToken)
      .send({ menuItemId: 'item-1', quantity: 1 })
      .expect(403);
  });

  it('enforces RBAC on payment operations', async () => {
    const store = await createTestStore();
    const order = await createTestOrder(store.id);

    // SERVER role cannot record payments
    const serverToken = await getAuthToken('server', store.id);
    await request(app.getHttpServer())
      .post(`/payments/orders/${order.id}`)
      .set('Authorization', `Bearer ${serverToken}`)
      .send({ paymentMethod: 'CASH', amountTendered: '50.00' })
      .expect(403);

    // CASHIER role can record payments
    const cashierToken = await getAuthToken('cashier', store.id);
    await request(app.getHttpServer())
      .post(`/payments/orders/${order.id}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ paymentMethod: 'CASH', amountTendered: '50.00' })
      .expect(201);
  });
});
```

---

### Input Validation & Injection Prevention

```gherkin
Scenario: SQL injection prevention
  When I POST /menu/items with name "'; DROP TABLE users; --"
  Then the item should be created with the exact name
  And no SQL should be executed

Scenario: XSS prevention
  When I POST /menu/items with name "<script>alert('xss')</script>"
  Then the item should be created with sanitized name
  And script tags should be escaped

Scenario: Price validation
  When I POST /menu/items with basePrice "-5.00"
  Then I should receive 400 Bad Request
  And error should say "Price must be positive"

  When I POST /menu/items with basePrice "abc"
  Then I should receive 400 Bad Request
  And error should say "Invalid price format"
```

---

## Performance Test Scenarios

### Load Testing - Reports Generation

```gherkin
Scenario: Generate sales report with 1000 orders
  Given 1000 orders exist in the database
  When I GET /reports/sales-summary?startDate=2025-01-01&endDate=2025-01-31
  Then the response should be received within 2 seconds
  And the response should contain aggregated data

Scenario: Concurrent KDS queries
  Given 20 KDS stations are active
  When all 20 stations poll for orders simultaneously
  Then each request should complete within 500ms
  And no database deadlocks should occur
```

**Artillery Load Test**:
```yaml
# load-tests/reports.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Sustained load"
  processor: "./auth-processor.js"

scenarios:
  - name: "Sales Report Generation"
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "owner@test.com"
            password: "test1234"
          capture:
            - json: "$.data.accessToken"
              as: "token"

      - get:
          url: "/reports/sales-summary?storeId=store-1&startDate=2025-01-01&endDate=2025-01-31"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200
            - contentType: json
          capture:
            - json: "$.data.totalSales"
              as: "totalSales"
```

---

### WebSocket Performance

```gherkin
Scenario: Cart sync with 50 concurrent sessions
  Given 50 active table sessions exist
  When items are added to all 50 carts simultaneously
  Then all cart updates should propagate within 1 second
  And no WebSocket connections should drop
  And no messages should be lost

Scenario: WebSocket reconnection under load
  Given a customer has an active cart session
  When the WebSocket server is restarted
  Then the client should reconnect automatically
  And cart data should be preserved
  And synchronization should resume
```

---

## Test Data Requirements

### Sample Stores

```typescript
const testStores = [
  {
    id: 'store-1',
    name: 'Downtown Bistro',
    slug: 'downtown-bistro',
    settings: {
      vatRate: '0.07',
      serviceChargeRate: '0.10',
      currency: 'USD'
    }
  },
  {
    id: 'store-2',
    name: 'Uptown Café',
    slug: 'uptown-cafe',
    settings: {
      vatRate: '0.05',
      serviceChargeRate: '0.00',
      currency: 'USD'
    }
  }
];
```

### Sample Menu Items

```typescript
const testMenuItems = [
  {
    id: 'item-burger',
    name: 'Classic Burger',
    basePrice: '12.99',
    routingArea: RoutingArea.GRILL,
    preparationTimeMinutes: 15,
    customizationGroups: [
      {
        id: 'group-additions',
        name: 'Add-ons',
        options: [
          { id: 'opt-cheese', name: 'Extra Cheese', price: '1.00' },
          { id: 'opt-bacon', name: 'Bacon', price: '2.00' }
        ]
      }
    ]
  },
  {
    id: 'item-fries',
    name: 'French Fries',
    basePrice: '4.99',
    routingArea: RoutingArea.FRY,
    preparationTimeMinutes: 8
  },
  {
    id: 'item-coke',
    name: 'Coca Cola',
    basePrice: '3.00',
    routingArea: RoutingArea.DRINKS,
    preparationTimeMinutes: 2
  },
  {
    id: 'item-salad',
    name: 'Caesar Salad',
    basePrice: '8.99',
    routingArea: RoutingArea.SALAD,
    preparationTimeMinutes: 10
  }
];
```

### Sample Users (Multiple Roles)

```typescript
const testUsers = [
  { email: 'owner@test.com', role: Role.OWNER, storeId: 'store-1' },
  { email: 'admin@test.com', role: Role.ADMIN, storeId: 'store-1' },
  { email: 'chef@test.com', role: Role.CHEF, storeId: 'store-1' },
  { email: 'cashier@test.com', role: Role.CASHIER, storeId: 'store-1' },
  { email: 'server@test.com', role: Role.SERVER, storeId: 'store-1' }
];
```

### Sample Orders (Various States)

```typescript
const testOrders = [
  {
    id: 'order-pending',
    status: OrderStatus.PENDING,
    grandTotal: '27.93',
    items: [/* ... */]
  },
  {
    id: 'order-preparing',
    status: OrderStatus.PREPARING,
    grandTotal: '50.00',
    items: [/* ... */]
  },
  {
    id: 'order-ready',
    status: OrderStatus.READY,
    grandTotal: '75.50',
    items: [/* ... */]
  },
  {
    id: 'order-completed',
    status: OrderStatus.COMPLETED,
    grandTotal: '100.00',
    payments: [
      { method: PaymentMethod.CASH, amount: '100.00', amountTendered: '120.00', change: '20.00' }
    ]
  }
];
```

---

## Test Execution Sequence

### Phase 1: Unit Tests (Backend)
**Duration**: 1-2 days

1. Routing Areas - MenuItem Service
2. Change Calculation - Payment Service
3. Table State Management - Table Service
4. Bill Splitting - Order Service

**Success Criteria**: 85%+ coverage, all tests passing

---

### Phase 2: Integration Tests (API)
**Duration**: 2-3 days

1. KDS Routing Area Endpoints
2. Payment Recording with Change
3. Table State Transitions
4. Bill Splitting Endpoints

**Success Criteria**: All endpoints tested, RBAC validated, multi-tenant isolation confirmed

---

### Phase 3: Component Tests (Frontend)
**Duration**: 2-3 days

**Priority Order**:
1. QR Code Generation Widget (CRITICAL)
2. Manual Order Form
3. Payment Recording UI
4. Bill Splitting Dialog
5. Reports Dashboard
6. Table State Dashboard

**Success Criteria**: All user interactions tested, loading/error states verified

---

### Phase 4: E2E Tests
**Duration**: 2-3 days

1. QR Scan → Order → Payment Flow
2. Counter Order Flow
3. Bill Split Flow
4. Kitchen Order Flow
5. Refund Flow

**Success Criteria**: All critical user journeys passing

---

### Phase 5: Security & Performance Tests
**Duration**: 1-2 days

1. Multi-tenant isolation
2. RBAC enforcement
3. Input validation
4. Load testing (reports, KDS)
5. WebSocket performance

**Success Criteria**: No security vulnerabilities, performance SLAs met

---

## Expected Test Results

### Backend Testing

| Module                  | Unit Tests | Integration Tests | Coverage | Status     |
| ----------------------- | ---------- | ----------------- | -------- | ---------- |
| MenuItem (Routing)      | 15         | 8                 | 90%+     | Ready      |
| Payment (Change Calc)   | 12         | 6                 | 95%+     | Ready      |
| Table (State Mgmt)      | 18         | 10                | 88%+     | Ready      |
| Order (Bill Splitting)  | 25         | 12                | 92%+     | To Implement |
| Kitchen (Routing)       | 10         | 5                 | 85%+     | To Implement |

**Total Backend**: ~80 new unit tests, ~41 new integration tests

---

### Frontend Testing

| Feature                 | Component Tests | E2E Tests | Coverage | Status         |
| ----------------------- | --------------- | --------- | -------- | -------------- |
| QR Code Generation      | 8               | 5         | 85%+     | To Implement   |
| Manual Order Form       | 6               | 2         | 80%+     | To Implement   |
| Payment Recording       | 5               | 2         | 80%+     | To Implement   |
| Bill Splitting          | 10              | 3         | 85%+     | To Implement   |
| Reports Dashboard       | 8               | 2         | 75%+     | To Implement   |
| Table State Dashboard   | 6               | 1         | 75%+     | To Implement   |

**Total Frontend**: ~43 new component tests, ~15 new E2E tests

---

### Security Testing

| Test Category           | Test Cases | Expected Failures | Status       |
| ----------------------- | ---------- | ----------------- | ------------ |
| Multi-Tenant Isolation  | 12         | 0                 | Should Pass  |
| RBAC Enforcement        | 15         | 0                 | Should Pass  |
| Input Validation        | 20         | 0                 | Should Pass  |
| Injection Prevention    | 8          | 0                 | Should Pass  |

**Total Security**: ~55 security test cases

---

### Performance Testing

| Scenario                | Target SLA   | Expected Result | Status     |
| ----------------------- | ------------ | --------------- | ---------- |
| GET /menu/items         | <200ms (p95) | ~120ms          | Should Pass |
| POST /orders            | <500ms (p95) | ~300ms          | Should Pass |
| Reports (1000 orders)   | <2s          | ~1.5s           | Should Pass |
| WebSocket Latency       | <1000ms      | ~500ms          | Should Pass |
| QR Generation           | <100ms       | ~50ms           | Should Pass |

---

## Regression Test Plan

### Critical Existing Features to Verify

**Cart Synchronization (SOS)**:
- [ ] Multi-device cart sync still works
- [ ] WebSocket reconnection seamless
- [ ] Optimistic updates rollback on error
- [ ] Session token validation enforced

**Order Lifecycle**:
- [ ] Order creation via checkout still works
- [ ] Order status transitions valid
- [ ] VAT/service charge calculation accurate
- [ ] Soft deletes preserved

**Payment/Refund**:
- [ ] Payment recording still works
- [ ] Refund processing still works
- [ ] Decimal precision maintained
- [ ] Store ownership validation enforced

**Menu Management**:
- [ ] Menu CRUD operations still work
- [ ] Customizations still work
- [ ] Image upload still works
- [ ] Soft deletes still work

**Kitchen Display**:
- [ ] KDS order display still works
- [ ] Status updates still work
- [ ] Real-time notifications still work (if implemented)

**Authentication**:
- [ ] Auth0 login still works
- [ ] JWT validation still works
- [ ] Store selection still works
- [ ] Session-based auth (customers) still works

---

## Test Coverage Gaps & Priorities

### Current Coverage

**Backend (Existing)**:
- CartService: 91% (52 tests) ✅
- OrderService: 98% (78 tests) ✅
- MenuService: 85% ✅
- CategoryService: 85% ✅
- TableService: 87% ✅
- UserService: 94% ✅

**Frontend (Existing)**:
- RMS: 7 widget tests, <5% business logic coverage ⚠️
- SOS: 0% coverage ❌ CRITICAL GAP

### Required Additional Coverage

**Backend Modules Needing Tests**:
1. PaymentService (change calculation logic) - HIGH PRIORITY
2. ActiveTableSessionService (table state transitions) - HIGH PRIORITY
3. KitchenService (routing area filtering) - MEDIUM PRIORITY
4. OrderService (bill splitting) - HIGH PRIORITY (new feature)

**Frontend Components Needing Tests**:
1. QR Code Generation Widget - CRITICAL PRIORITY
2. Manual Order Form - HIGH PRIORITY
3. Payment Recording UI - HIGH PRIORITY
4. Bill Splitting Dialog - HIGH PRIORITY
5. Reports Dashboard - MEDIUM PRIORITY
6. Table State Dashboard - MEDIUM PRIORITY

**SOS App** (CRITICAL GAP):
- Cart functionality - HIGH PRIORITY
- WebSocket sync - HIGH PRIORITY
- Session management - HIGH PRIORITY
- Checkout flow - HIGH PRIORITY

**Estimated Testing Effort**:
- Backend: ~80 new unit tests, ~41 integration tests (5-7 days)
- Frontend RMS: ~43 component tests, ~10 E2E tests (5-7 days)
- Frontend SOS: ~30 component tests, ~5 E2E tests (3-5 days)
- Security & Performance: ~55 test cases (2-3 days)

**Total**: 15-22 developer days

---

## Acceptance Criteria for Release Slice A

### Functional Requirements

**QR Code Generation** (CRITICAL):
- [ ] QR codes generated for all tables
- [ ] QR codes downloadable as PNG
- [ ] QR codes printable (single and bulk)
- [ ] QR codes contain correct table URLs
- [ ] QR code scanning creates sessions successfully

**Manual Order Creation**:
- [ ] Staff can create counter orders
- [ ] Staff can create takeout orders
- [ ] Items with customizations can be added
- [ ] Order validation works correctly
- [ ] Orders appear in KDS after creation

**Payment Recording**:
- [ ] Cash payments calculate change accurately
- [ ] Non-cash payments work correctly
- [ ] Payment validation prevents insufficient amounts
- [ ] Decimal precision maintained (no float errors)
- [ ] Receipts generated after payment

**Bill Splitting**:
- [ ] Orders can be split equally
- [ ] Orders can be split by items
- [ ] All items must be allocated validation works
- [ ] Payments recorded per split
- [ ] Order marked complete when all splits paid

**Table State Management**:
- [ ] Table states display correctly
- [ ] State transitions validated
- [ ] Auto-transitions on session close work
- [ ] Real-time updates (if implemented)

**Routing Areas**:
- [ ] Menu items have routing areas
- [ ] KDS filters by routing area
- [ ] Orders routed to correct stations

**Reports**:
- [ ] Sales summary displays correctly
- [ ] Top items report works
- [ ] Payment breakdown accurate
- [ ] Date range filtering works
- [ ] CSV export functional (if implemented)

---

### Quality Requirements

**Testing**:
- [ ] All P0 issues resolved
- [ ] Backend critical modules 85%+ coverage
- [ ] Frontend critical features tested
- [ ] Security scan passed
- [ ] Performance benchmarks met

**Security**:
- [ ] Multi-tenant isolation verified (2+ stores)
- [ ] RBAC enforced on all new endpoints
- [ ] Session token validation on cart operations
- [ ] Store ownership validation on payments
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities

**Performance**:
- [ ] API response times meet SLAs
- [ ] WebSocket latency <1s
- [ ] Reports generate within 2s (1000 orders)
- [ ] QR generation <100ms per code
- [ ] No database deadlocks under load

**User Experience**:
- [ ] RMS works on desktop (1024px+)
- [ ] SOS works on mobile (320px+)
- [ ] All text in 4 languages
- [ ] WCAG 2.1 AA compliance
- [ ] Loading states displayed
- [ ] Error messages user-friendly

**Deployment Readiness**:
- [ ] All migrations tested
- [ ] Seed data updated
- [ ] Environment variables documented
- [ ] Rollback plan documented
- [ ] Monitoring configured

---

## Deployment Readiness Rating

**Overall Rating**: **Not Ready** (75% complete)

**Critical Blockers**:
1. ❌ QR Code Generation UI missing (BLOCKER)
2. ❌ Bill Splitting not implemented (HIGH RISK)
3. ❌ Payment UI incomplete (HIGH PRIORITY)
4. ⚠️ SOS app has 0% test coverage (CRITICAL GAP)

**Recommendation**: **Hold Release** - Implement critical features and testing before deployment

**Minimum Viable Release**:
- ✅ QR Code Generation UI implemented and tested
- ✅ Manual Order Creation functional
- ✅ Payment Recording with change calculation working
- ⚠️ Bill Splitting can be deferred to post-MVP
- ✅ Reports Dashboard implemented
- ✅ Security validations in place
- ✅ 85%+ test coverage on critical paths

---

## Summary: Test Strategy for Critical Features

### QR Code Generation (CRITICAL BLOCKER)

**Why Critical**: Without QR codes, table ordering cannot be deployed. This blocks the entire customer self-service flow.

**Test Focus**:
- QR code rendering accuracy
- Download/print functionality
- Bulk operations
- Error handling
- E2E scanning and session creation

**Risk**: BLOCKER for Release Slice A

**Estimated Testing**: 2 days (component + E2E tests)

---

### Bill Splitting (HIGH RISK)

**Why High Risk**: Complex financial logic with multiple edge cases. Incorrect splits result in payment discrepancies.

**Test Focus**:
- Decimal precision (avoid float errors)
- Equal split calculation
- Item-based split allocation
- Validation (all items assigned, no double allocation)
- Multi-payment recording
- Order completion logic

**Risk**: HIGH - Financial accuracy critical

**Estimated Testing**: 3 days (unit + integration + E2E)

---

### Payment Recording with Change Calculation (HIGH RISK)

**Why High Risk**: Financial calculations must be exact. Change calculation errors impact customer trust and cash reconciliation.

**Test Focus**:
- Decimal precision for change
- Insufficient amount validation
- Exact amount handling
- Payment method validation
- Cash vs. non-cash logic

**Risk**: HIGH - Financial accuracy critical

**Estimated Testing**: 2 days (unit + integration tests)

---

### Manual Order Creation (HIGH PRIORITY)

**Why High Priority**: Core POS functionality. Without this, staff cannot handle phone orders or walk-ins.

**Test Focus**:
- Order type validation (counter, takeout, dine-in)
- Item addition with customizations
- Price calculation accuracy
- Order submission workflow
- Error handling

**Risk**: MEDIUM - Functional gap but no financial risk

**Estimated Testing**: 2 days (component + E2E tests)

---

### Table State Management (MEDIUM RISK)

**Why Medium Risk**: State consistency important but failures are recoverable. No direct financial impact.

**Test Focus**:
- State transition validation
- Auto-transitions on events
- Concurrent state updates
- Real-time synchronization (if implemented)

**Risk**: MEDIUM - Operational efficiency impact

**Estimated Testing**: 2 days (unit + integration tests)

---

**Total Critical Path Testing**: 11 days

**Parallel Testing Opportunities**: Component tests and unit tests can run in parallel, reducing timeline to ~7-8 days with 2 QA engineers.

---

**Document End**
