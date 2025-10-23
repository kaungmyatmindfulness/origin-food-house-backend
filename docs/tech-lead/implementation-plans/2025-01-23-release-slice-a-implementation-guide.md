# Release Slice A Implementation Guide

**Date**: 2025-01-23
**Author**: Senior Fullstack Engineer (Tech Lead Function)
**Scope**: Implementation guidance for missing features in Release Slice A
**Gap Analysis Reference**: `docs/business-analyst/requirements/2025-01-23-release-slice-a-gap-analysis.md`

---

## Executive Summary

**CRITICAL UPDATE**: The gap analysis identified QR Code Generation UI as the critical blocker. However, **this feature is ALREADY FULLY IMPLEMENTED** at `/hub/(owner-admin)/tables/qr-code`. This removes the only CRITICAL blocker!

**Revised Completion Status**: **85% Complete** (up from 75%)
- Backend: 90% (up from 85%)
- Frontend RMS: 60% (up from 50%)
- Frontend SOS: 50% (same)

**Remaining Work**: ~12-15 developer days (down from 15-20 days)

**Top 5 Priorities** (Revised):
1. **Routing Areas for KDS** (Backend + Frontend) - HIGH
2. **Change Calculation for Cash Payments** (Backend + Frontend) - HIGH
3. **RMS Manual Order Creation** - HIGH
4. **Bill Splitting** (Complex) - HIGH
5. **Payment Recording UI** - HIGH

---

## Table of Contents

1. [Quick Wins (< 1 Day)](#quick-wins)
2. [Backend Implementation Guides](#backend-implementation-guides)
3. [Frontend Implementation Guides](#frontend-implementation-guides)
4. [Complex Features (Multi-Day)](#complex-features)
5. [Shared Patterns](#shared-patterns)
6. [Testing Implementation](#testing-implementation)
7. [Code Review Checklist](#code-review-checklist)
8. [Performance Considerations](#performance-considerations)

---

## Quick Wins (< 1 Day)

### 1. ~~QR Code Generation UI~~ ✅ ALREADY COMPLETE

**Status**: **FULLY IMPLEMENTED**

**Location**: `/apps/restaurant-management-system/src/app/[locale]/hub/(owner-admin)/tables/qr-code/page.tsx`

**Features**:
- ✅ QR code generation using `qrcode.react`
- ✅ Individual download per table (PNG format)
- ✅ Bulk print all QR codes
- ✅ Print-optimized CSS with `react-to-print`
- ✅ Loading skeletons
- ✅ Error handling
- ✅ i18n support (4 languages)

**QR Code Format**:
```typescript
const qrValue = `${customerAppBaseUrl}/table-sessions/join-by-table-id/${tableId}`;
```

**No action required**. This feature can be deployed immediately.

---

### 2. Preparation Times Field (Backend)

**Estimated Effort**: 0.5 developer days

**Schema Change**:

```prisma
// prisma/schema.prisma
model MenuItem {
  // ... existing fields
  preparationTimeMinutes Int?  // Add this field
  // ... rest of model
}
```

**Migration**:

```bash
cd origin-food-house-backend
npx prisma migrate dev --name add_preparation_time_to_menu_item
npm run generate:db
```

**DTO Updates**:

```typescript
// src/menu/dto/create-menu-item.dto.ts
export class CreateMenuItemDto {
  // ... existing fields

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480) // 8 hours max
  preparationTimeMinutes?: number;
}

// src/menu/dto/update-menu-item.dto.ts
export class UpdateMenuItemDto {
  // ... existing fields

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  preparationTimeMinutes?: number;
}
```

**Service Updates** (No changes needed - DTOs handle it automatically):

```typescript
// src/menu/menu.service.ts
// Prisma will automatically include/exclude preparationTimeMinutes
// No code changes needed in service layer
```

**Frontend Updates** (RMS Menu Form):

```typescript
// Add to menu item form schema
const menuItemSchema = z.object({
  // ... existing fields
  preparationTimeMinutes: z.number().int().min(1).max(480).optional(),
});

// Add form field
<FormField
  control={form.control}
  name="preparationTimeMinutes"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t('preparationTime')}</FormLabel>
      <FormControl>
        <Input
          type="number"
          min={1}
          max={480}
          placeholder={t('preparationTimePlaceholder')}
          {...field}
          onChange={(e) => field.onChange(e.target.valueAsNumber)}
        />
      </FormControl>
      <FormDescription>{t('preparationTimeHelp')}</FormDescription>
    </FormItem>
  )}
/>
```

**i18n Additions** (Add to all 4 languages):

```json
// messages/en.json
{
  "menu": {
    "preparationTime": "Preparation Time (minutes)",
    "preparationTimePlaceholder": "15",
    "preparationTimeHelp": "Estimated time to prepare this dish"
  }
}
```

**Test Cases**:

```typescript
// src/menu/menu.service.spec.ts
describe('createMenuItem', () => {
  it('should create menu item with preparation time', async () => {
    const dto = {
      name: 'Grilled Salmon',
      basePrice: '25.99',
      categoryId: 'cat-123',
      preparationTimeMinutes: 20,
    };

    prismaMock.menuItem.create.mockResolvedValue({
      ...dto,
      id: 'item-123',
      preparationTimeMinutes: 20,
    });

    const result = await service.createMenuItem('user-1', 'store-1', dto);
    expect(result.preparationTimeMinutes).toBe(20);
  });

  it('should reject preparation time > 480 minutes', async () => {
    const dto = {
      name: 'Test',
      basePrice: '10.00',
      categoryId: 'cat-123',
      preparationTimeMinutes: 500, // Invalid
    };

    await expect(service.createMenuItem('user-1', 'store-1', dto))
      .rejects.toThrow(BadRequestException);
  });
});
```

---

### 3. Quick "86" Toggle (Frontend RMS)

**Estimated Effort**: 0.5 developer days

**Location**: `/apps/restaurant-management-system/src/features/menu/components/MenuItemCard.tsx` (or similar)

**API Endpoint** (Already exists):
```typescript
PATCH /menu/:itemId?storeId=X
Body: { isOutOfStock: true }
```

**Component Pattern**:

```typescript
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@repo/ui/components/switch';
import { toast } from 'sonner';
import { updateMenuItem } from '@/features/menu/services/menu.service';

export function MenuItem86Toggle({ item, storeId }: Props) {
  const queryClient = useQueryClient();
  const t = useTranslations('menu');

  const mutation = useMutation({
    mutationFn: (isOutOfStock: boolean) =>
      updateMenuItem(storeId, item.id, { isOutOfStock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.items(storeId) });
      toast.success(
        isOutOfStock ? t('item86d') : t('itemAvailable')
      );
    },
    onError: (error) => {
      toast.error(error.message || t('updateFailed'));
    },
  });

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={item.isOutOfStock}
        onCheckedChange={mutation.mutate}
        disabled={mutation.isPending}
      />
      <label className="text-sm">
        {item.isOutOfStock ? t('outOfStock') : t('available')}
      </label>
    </div>
  );
}
```

**SOS Auto-Filtering** (Already filtered in backend query):

```typescript
// Backend: src/menu/menu.service.ts
async findMenuItems(storeId: string) {
  return this.prisma.menuItem.findMany({
    where: {
      storeId,
      deletedAt: null,
      isHidden: false,
      isOutOfStock: false, // ✅ Already filtered
    },
  });
}
```

**i18n Additions**:

```json
{
  "menu": {
    "item86d": "Item marked as out of stock",
    "itemAvailable": "Item marked as available",
    "outOfStock": "Out of Stock (86'd)",
    "available": "Available"
  }
}
```

---

## Backend Implementation Guides

### 1. Routing Areas for KDS (HIGH Priority)

**Estimated Effort**: 1 developer day

**Problem**: Menu items cannot be routed to specific kitchen stations (Grill, Fry, Salad, etc.)

**Solution**: Add `routingArea` enum to MenuItem model

#### Step 1: Schema Change

```prisma
// prisma/schema.prisma

// Add enum
enum RoutingArea {
  GRILL
  FRY
  SALAD
  DRINKS
  DESSERT
  OTHER
}

// Update MenuItem model
model MenuItem {
  // ... existing fields
  routingArea RoutingArea @default(OTHER) // Add this field
  // ... rest of model
}
```

#### Step 2: Migration

```bash
cd origin-food-house-backend
npx prisma migrate dev --name add_routing_area_to_menu_item
npm run generate:db
```

#### Step 3: DTO Updates

```typescript
// src/menu/dto/create-menu-item.dto.ts
import { RoutingArea } from '@prisma/client';

export class CreateMenuItemDto {
  // ... existing fields

  @IsEnum(RoutingArea)
  @IsOptional()
  routingArea?: RoutingArea;
}

// src/menu/dto/update-menu-item.dto.ts
export class UpdateMenuItemDto {
  // ... existing fields

  @IsEnum(RoutingArea)
  @IsOptional()
  routingArea?: RoutingArea;
}
```

#### Step 4: KDS Endpoint Enhancement

```typescript
// src/kitchen/kitchen.controller.ts

@Get('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
async getKitchenOrders(
  @Req() req: RequestWithUser,
  @Query('storeId', ParseUUIDPipe) storeId: string,
  @Query('routingArea') routingArea?: RoutingArea, // Add this param
) {
  const userId = req.user.sub;
  return await this.kitchenService.getKitchenOrders(
    userId,
    storeId,
    routingArea
  );
}

// src/kitchen/kitchen.service.ts
async getKitchenOrders(
  userId: string,
  storeId: string,
  routingArea?: RoutingArea
) {
  await this.authService.checkStorePermission(userId, storeId, [
    Role.OWNER,
    Role.ADMIN,
    Role.CHEF,
  ]);

  // Build where clause
  const whereClause: Prisma.OrderWhereInput = {
    storeId,
    status: { in: ['PENDING', 'PREPARING', 'READY'] },
  };

  return await this.prisma.order.findMany({
    where: whereClause,
    include: {
      orderItems: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              routingArea: true, // ✅ Include routing area
            },
          },
        },
        // Filter items by routing area if specified
        ...(routingArea && {
          where: {
            menuItem: {
              routingArea: routingArea,
            },
          },
        }),
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}
```

#### Step 5: Frontend Types (Auto-Generated)

```bash
cd origin-food-house-frontend
npm run generate:api
```

This will generate:

```typescript
// packages/api/generated/types.ts
export enum RoutingArea {
  GRILL = 'GRILL',
  FRY = 'FRY',
  SALAD = 'SALAD',
  DRINKS = 'DRINKS',
  DESSERT = 'DESSERT',
  OTHER = 'OTHER',
}
```

#### Step 6: Frontend KDS Tabs

```typescript
// apps/restaurant-management-system/src/features/kitchen/components/KdsStationTabs.tsx
'use client';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@repo/ui/components/tabs';
import { RoutingArea } from '@repo/api/generated/types';

const STATION_TABS = [
  { value: 'ALL', label: 'All' },
  { value: RoutingArea.GRILL, label: 'Grill' },
  { value: RoutingArea.FRY, label: 'Fry' },
  { value: RoutingArea.SALAD, label: 'Salad' },
  { value: RoutingArea.DRINKS, label: 'Drinks' },
  { value: RoutingArea.DESSERT, label: 'Dessert' },
  { value: RoutingArea.OTHER, label: 'Other' },
];

export function KdsStationTabs({ storeId }: Props) {
  const [activeStation, setActiveStation] = useState<string>('ALL');
  const t = useTranslations('kitchen');

  return (
    <Tabs value={activeStation} onValueChange={setActiveStation}>
      <TabsList>
        {STATION_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {t(`station.${tab.label.toLowerCase()}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      {STATION_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          <KdsOrderList
            storeId={storeId}
            routingArea={tab.value === 'ALL' ? undefined : tab.value}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

// Service function
export async function getKitchenOrders(
  storeId: string,
  routingArea?: RoutingArea
): Promise<OrderResponseDto[]> {
  const res = await apiFetch<OrderResponseDto[]>({
    path: '/kitchen/orders',
    query: { storeId, ...(routingArea && { routingArea }) },
  });
  return unwrapData(res, 'Failed to fetch kitchen orders');
}
```

#### Step 7: RMS Menu Form Update

```typescript
// Add routing area selector to menu item form
<FormField
  control={form.control}
  name="routingArea"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t('routingArea')}</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={t('selectStation')} />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value={RoutingArea.GRILL}>{t('grill')}</SelectItem>
          <SelectItem value={RoutingArea.FRY}>{t('fry')}</SelectItem>
          <SelectItem value={RoutingArea.SALAD}>{t('salad')}</SelectItem>
          <SelectItem value={RoutingArea.DRINKS}>{t('drinks')}</SelectItem>
          <SelectItem value={RoutingArea.DESSERT}>{t('dessert')}</SelectItem>
          <SelectItem value={RoutingArea.OTHER}>{t('other')}</SelectItem>
        </SelectContent>
      </Select>
    </FormItem>
  )}
/>
```

#### Step 8: Test Cases

```typescript
// src/kitchen/kitchen.service.spec.ts
describe('getKitchenOrders', () => {
  it('should filter orders by routing area GRILL', async () => {
    const orders = [
      {
        id: 'order-1',
        orderItems: [
          { menuItem: { routingArea: 'GRILL', name: 'Steak' } },
          { menuItem: { routingArea: 'SALAD', name: 'Caesar Salad' } },
        ],
      },
    ];

    prismaMock.order.findMany.mockResolvedValue(orders);

    const result = await service.getKitchenOrders(
      'user-1',
      'store-1',
      RoutingArea.GRILL
    );

    // Should only include GRILL items
    expect(result[0].orderItems).toHaveLength(1);
    expect(result[0].orderItems[0].menuItem.routingArea).toBe('GRILL');
  });
});
```

#### Data Migration Script (Optional)

If you have existing menu items and want to intelligently assign routing areas:

```typescript
// scripts/assign-routing-areas.ts
import { PrismaClient, RoutingArea } from '@prisma/client';

const prisma = new PrismaClient();

const ROUTING_KEYWORDS = {
  GRILL: ['steak', 'burger', 'grilled', 'bbq', 'kebab'],
  FRY: ['fried', 'fries', 'tempura', 'crispy', 'nugget'],
  SALAD: ['salad', 'fresh', 'vegetable'],
  DRINKS: ['juice', 'soda', 'coffee', 'tea', 'beer', 'wine', 'cocktail'],
  DESSERT: ['cake', 'ice cream', 'dessert', 'pie', 'pudding'],
};

async function assignRoutingAreas() {
  const items = await prisma.menuItem.findMany({
    where: { routingArea: RoutingArea.OTHER },
  });

  for (const item of items) {
    const nameLower = item.name.toLowerCase();
    let assigned = RoutingArea.OTHER;

    for (const [area, keywords] of Object.entries(ROUTING_KEYWORDS)) {
      if (keywords.some(kw => nameLower.includes(kw))) {
        assigned = area as RoutingArea;
        break;
      }
    }

    await prisma.menuItem.update({
      where: { id: item.id },
      data: { routingArea: assigned },
    });

    console.log(`${item.name} → ${assigned}`);
  }
}

assignRoutingAreas()
  .then(() => console.log('Done'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run with: `npx ts-node scripts/assign-routing-areas.ts`

---

### 2. Change Calculation for Cash Payments (HIGH Priority)

**Estimated Effort**: 0.5 developer days

**Problem**: Payment model doesn't track `amountTendered` for cash payments, so change cannot be calculated.

**Solution**: Add `amountTendered` field to Payment model

#### Step 1: Schema Change

```prisma
// prisma/schema.prisma
model Payment {
  id              String        @id @default(uuid(7))
  orderId         String
  amount          Decimal       @db.Decimal(10, 2)
  amountTendered  Decimal?      @db.Decimal(10, 2) // Add this field
  paymentMethod   PaymentMethod
  transactionId   String?
  notes           String?

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  @@index([orderId])
  @@index([transactionId])
}
```

#### Step 2: Migration

```bash
cd origin-food-house-backend
npx prisma migrate dev --name add_amount_tendered_to_payment
npm run generate:db
```

#### Step 3: DTO Updates

```typescript
// src/payment/dto/record-payment.dto.ts
import { IsDecimal, IsEnum, IsOptional, IsString } from 'class-validator';

export class RecordPaymentDto {
  @IsDecimal()
  amount: string; // String for Decimal precision

  @IsDecimal()
  @IsOptional()
  amountTendered?: string; // Add this field (required if paymentMethod === CASH)

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

#### Step 4: Service Logic with Validation

```typescript
// src/payment/payment.service.ts
import { Decimal } from '@prisma/client/runtime/library';

async recordPayment(
  userId: string,
  orderId: string,
  dto: RecordPaymentDto
): Promise<Payment> {
  const method = this.recordPayment.name;

  // Validate order ownership (existing security check)
  await this.validateOrderStoreAccess(orderId, userId, [
    Role.OWNER,
    Role.ADMIN,
    Role.CASHIER,
  ]);

  // Get order
  const order = await this.prisma.order.findUniqueOrThrow({
    where: { id: orderId },
  });

  // Validate payment amount
  const amount = new Decimal(dto.amount);
  const grandTotal = order.grandTotal;

  if (amount.lessThan(grandTotal)) {
    throw new BadRequestException(
      `Payment amount (${amount}) is less than order total (${grandTotal})`
    );
  }

  // Validate cash payment requires amountTendered
  if (dto.paymentMethod === PaymentMethod.CASH) {
    if (!dto.amountTendered) {
      throw new BadRequestException(
        'Cash payments require amountTendered field'
      );
    }

    const amountTendered = new Decimal(dto.amountTendered);

    // Validate tendered amount >= payment amount
    if (amountTendered.lessThan(amount)) {
      throw new BadRequestException(
        `Amount tendered (${amountTendered}) is less than payment amount (${amount})`
      );
    }

    // Calculate change (logged for audit)
    const change = amountTendered.minus(amount);
    this.logger.log(
      `[${method}] Cash payment: Tendered=${amountTendered}, Change=${change}`
    );
  }

  // Record payment
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

  // Update order paidAt
  await this.prisma.order.update({
    where: { id: orderId },
    data: { paidAt: new Date() },
  });

  this.logger.log(`[${method}] Payment recorded for Order ${orderId}`);

  return payment;
}
```

#### Step 5: Response DTO with Calculated Change

```typescript
// src/payment/dto/payment-response.dto.ts
import { Decimal } from '@prisma/client/runtime/library';

export class PaymentResponseDto {
  id: string;
  orderId: string;
  amount: string;
  amountTendered?: string;
  change?: string; // Calculated field
  paymentMethod: PaymentMethod;
  transactionId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(payment: Payment): PaymentResponseDto {
    const dto = new PaymentResponseDto();
    dto.id = payment.id;
    dto.orderId = payment.orderId;
    dto.amount = payment.amount.toString();
    dto.amountTendered = payment.amountTendered?.toString();
    dto.paymentMethod = payment.paymentMethod;
    dto.transactionId = payment.transactionId;
    dto.notes = payment.notes;
    dto.createdAt = payment.createdAt;
    dto.updatedAt = payment.updatedAt;

    // Calculate change if cash payment
    if (payment.amountTendered) {
      const change = new Decimal(payment.amountTendered)
        .minus(new Decimal(payment.amount));
      dto.change = change.toString();
    }

    return dto;
  }
}
```

#### Step 6: Frontend Payment Form

```typescript
// apps/restaurant-management-system/src/features/payment/components/PaymentForm.tsx
'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Decimal from 'decimal.js';

const paymentSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_PAYMENT']),
  amountTendered: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // Cash payments require amountTendered
  if (data.paymentMethod === 'CASH' && !data.amountTendered) {
    return false;
  }
  return true;
}, {
  message: 'Amount tendered is required for cash payments',
  path: ['amountTendered'],
});

type FormValues = z.infer<typeof paymentSchema>;

export function PaymentForm({ order }: Props) {
  const t = useTranslations('payment');
  const [calculatedChange, setCalculatedChange] = useState<string>('0.00');

  const form = useForm<FormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentMethod: 'CASH',
      amountTendered: '',
      notes: '',
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const amountTendered = form.watch('amountTendered');

  // Calculate change in real-time
  useEffect(() => {
    if (paymentMethod === 'CASH' && amountTendered) {
      try {
        const tendered = new Decimal(amountTendered);
        const total = new Decimal(order.grandTotal);
        const change = tendered.minus(total);

        if (change.greaterThanOrEqualTo(0)) {
          setCalculatedChange(change.toFixed(2));
        } else {
          setCalculatedChange('0.00');
        }
      } catch {
        setCalculatedChange('0.00');
      }
    } else {
      setCalculatedChange('0.00');
    }
  }, [paymentMethod, amountTendered, order.grandTotal]);

  const onSubmit = async (data: FormValues) => {
    try {
      await recordPayment(order.id, {
        amount: order.grandTotal,
        amountTendered: data.amountTendered,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      });

      toast.success(t('paymentRecorded'));
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || t('paymentFailed'));
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Order Summary */}
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">{t('orderSummary')}</h3>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{t('subtotal')}</span>
              <span>{formatCurrency(order.subTotal, 'THB')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('vat')}</span>
              <span>{formatCurrency(order.vatAmount, 'THB')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('serviceCharge')}</span>
              <span>{formatCurrency(order.serviceChargeAmount, 'THB')}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>{t('grandTotal')}</span>
              <span>{formatCurrency(order.grandTotal, 'THB')}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('paymentMethod')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="CASH">{t('cash')}</SelectItem>
                  <SelectItem value="CREDIT_CARD">{t('creditCard')}</SelectItem>
                  <SelectItem value="DEBIT_CARD">{t('debitCard')}</SelectItem>
                  <SelectItem value="MOBILE_PAYMENT">{t('mobilePayment')}</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {/* Amount Tendered (Cash only) */}
        {paymentMethod === 'CASH' && (
          <FormField
            control={form.control}
            name="amountTendered"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('amountTendered')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={order.grandTotal}
                    placeholder={order.grandTotal}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{t('amountTenderedHelp')}</FormDescription>
              </FormItem>
            )}
          />
        )}

        {/* Change Display (Cash only) */}
        {paymentMethod === 'CASH' && (
          <div className="rounded-lg bg-muted p-4">
            <div className="flex justify-between text-lg font-bold">
              <span>{t('changeToReturn')}</span>
              <span className="text-primary">
                {formatCurrency(calculatedChange, 'THB')}
              </span>
            </div>
          </div>
        )}

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('notes')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('notesPlaceholder')}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          {t('recordPayment')}
        </Button>
      </form>
    </Form>
  );
}
```

#### Step 7: Test Cases

```typescript
// src/payment/payment.service.spec.ts
describe('recordPayment', () => {
  it('should calculate change for cash payment', async () => {
    const order = {
      id: 'order-1',
      grandTotal: new Decimal('100.00'),
    };

    const dto = {
      amount: '100.00',
      amountTendered: '150.00',
      paymentMethod: PaymentMethod.CASH,
    };

    prismaMock.order.findUniqueOrThrow.mockResolvedValue(order);
    prismaMock.payment.create.mockResolvedValue({
      ...dto,
      id: 'payment-1',
      amount: new Decimal('100.00'),
      amountTendered: new Decimal('150.00'),
    });

    const result = await service.recordPayment('user-1', 'order-1', dto);

    expect(result.amountTendered.toString()).toBe('150.00');
    // Change = 150 - 100 = 50
  });

  it('should reject cash payment without amountTendered', async () => {
    const dto = {
      amount: '100.00',
      paymentMethod: PaymentMethod.CASH,
    };

    await expect(service.recordPayment('user-1', 'order-1', dto))
      .rejects.toThrow('Cash payments require amountTendered field');
  });

  it('should reject tendered amount < payment amount', async () => {
    const order = {
      id: 'order-1',
      grandTotal: new Decimal('100.00'),
    };

    const dto = {
      amount: '100.00',
      amountTendered: '50.00', // Too low
      paymentMethod: PaymentMethod.CASH,
    };

    prismaMock.order.findUniqueOrThrow.mockResolvedValue(order);

    await expect(service.recordPayment('user-1', 'order-1', dto))
      .rejects.toThrow('Amount tendered');
  });

  it('should allow non-cash payment without amountTendered', async () => {
    const order = {
      id: 'order-1',
      grandTotal: new Decimal('100.00'),
    };

    const dto = {
      amount: '100.00',
      paymentMethod: PaymentMethod.CREDIT_CARD,
    };

    prismaMock.order.findUniqueOrThrow.mockResolvedValue(order);
    prismaMock.payment.create.mockResolvedValue({
      ...dto,
      id: 'payment-1',
      amount: new Decimal('100.00'),
      amountTendered: null,
    });

    const result = await service.recordPayment('user-1', 'order-1', dto);

    expect(result.amountTendered).toBeNull();
  });
});
```

---

### 3. Table State Management (HIGH Priority)

**Estimated Effort**: 1 developer day

**Problem**: No explicit table state tracking (Vacant, Seated, Ordering, Served, etc.)

**Solution**: Add `currentStatus` enum to Table model

#### Step 1: Schema Change

```prisma
// prisma/schema.prisma

// Add enum
enum TableStatus {
  VACANT
  SEATED
  ORDERING
  SERVED
  READY_TO_PAY
  CLEANING
}

// Update Table model
model Table {
  id            String       @id @default(uuid(7))
  storeId       String
  name          String
  currentStatus TableStatus  @default(VACANT) // Add this field
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @default(now()) @updatedAt

  store               Store                  @relation(fields: [storeId], references: [id], onDelete: Cascade)
  activeTableSessions ActiveTableSession[]

  @@unique([storeId, name])
  @@index([storeId, name])
  @@index([storeId, currentStatus]) // Add index for filtering
}
```

#### Step 2: Migration

```bash
cd origin-food-house-backend
npx prisma migrate dev --name add_table_status
npm run generate:db
```

#### Step 3: State Transition Logic

```typescript
// src/table/table.service.ts
import { TableStatus } from '@prisma/client';

// Valid state transitions
const VALID_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  [TableStatus.VACANT]: [TableStatus.SEATED],
  [TableStatus.SEATED]: [TableStatus.ORDERING, TableStatus.VACANT],
  [TableStatus.ORDERING]: [TableStatus.SERVED],
  [TableStatus.SERVED]: [TableStatus.READY_TO_PAY],
  [TableStatus.READY_TO_PAY]: [TableStatus.CLEANING],
  [TableStatus.CLEANING]: [TableStatus.VACANT],
};

async updateTableStatus(
  userId: string,
  storeId: string,
  tableId: string,
  newStatus: TableStatus
): Promise<Table> {
  await this.authService.checkStorePermission(userId, storeId, [
    Role.OWNER,
    Role.ADMIN,
    Role.SERVER,
  ]);

  const table = await this.findOne(storeId, tableId);

  // Validate state transition
  const validNextStates = VALID_TRANSITIONS[table.currentStatus];
  if (!validNextStates.includes(newStatus)) {
    throw new BadRequestException(
      `Cannot transition from ${table.currentStatus} to ${newStatus}. ` +
      `Valid transitions: ${validNextStates.join(', ')}`
    );
  }

  const updatedTable = await this.prisma.table.update({
    where: { id: tableId },
    data: { currentStatus: newStatus },
  });

  this.logger.log(
    `Table ${tableId} status: ${table.currentStatus} → ${newStatus}`
  );

  return updatedTable;
}

// Automatic state transitions based on session events
async handleSessionCreated(sessionId: string): Promise<void> {
  const session = await this.prisma.activeTableSession.findUnique({
    where: { id: sessionId },
    include: { table: true },
  });

  if (session && session.table.currentStatus === TableStatus.VACANT) {
    await this.prisma.table.update({
      where: { id: session.tableId },
      data: { currentStatus: TableStatus.SEATED },
    });

    this.logger.log(
      `Auto-transitioned table ${session.tableId} to SEATED`
    );
  }
}

async handleOrderPlaced(orderId: string): Promise<void> {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: { session: { include: { table: true } } },
  });

  if (order?.session?.table &&
      order.session.table.currentStatus === TableStatus.SEATED) {
    await this.prisma.table.update({
      where: { id: order.session.tableId },
      data: { currentStatus: TableStatus.ORDERING },
    });

    this.logger.log(
      `Auto-transitioned table ${order.session.tableId} to ORDERING`
    );
  }
}

async handleOrderCompleted(orderId: string): Promise<void> {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: { session: { include: { table: true } } },
  });

  if (order?.session?.table &&
      order.session.table.currentStatus === TableStatus.ORDERING) {
    await this.prisma.table.update({
      where: { id: order.session.tableId },
      data: { currentStatus: TableStatus.SERVED },
    });

    this.logger.log(
      `Auto-transitioned table ${order.session.tableId} to SERVED`
    );
  }
}

async handlePaymentRecorded(orderId: string): Promise<void> {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: { session: { include: { table: true } } },
  });

  if (order?.session?.table &&
      order.session.table.currentStatus === TableStatus.SERVED) {
    await this.prisma.table.update({
      where: { id: order.session.tableId },
      data: { currentStatus: TableStatus.READY_TO_PAY },
    });

    this.logger.log(
      `Auto-transitioned table ${order.session.tableId} to READY_TO_PAY`
    );
  }
}

async handleSessionClosed(sessionId: string): Promise<void> {
  const session = await this.prisma.activeTableSession.findUnique({
    where: { id: sessionId },
    include: { table: true },
  });

  if (session && session.table.currentStatus !== TableStatus.VACANT) {
    await this.prisma.table.update({
      where: { id: session.tableId },
      data: { currentStatus: TableStatus.CLEANING },
    });

    this.logger.log(
      `Auto-transitioned table ${session.tableId} to CLEANING`
    );
  }
}
```

#### Step 4: Controller Endpoint

```typescript
// src/table/table.controller.ts

@Patch(':tableId/status')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Update table status (OWNER/ADMIN/SERVER Required)' })
async updateTableStatus(
  @Req() req: RequestWithUser,
  @Param('storeId', ParseUUIDPipe) storeId: string,
  @Param('tableId', ParseUUIDPipe) tableId: string,
  @Body() dto: UpdateTableStatusDto,
): Promise<StandardApiResponse<TableResponseDto>> {
  const userId = req.user.sub;
  const updatedTable = await this.tableService.updateTableStatus(
    userId,
    storeId,
    tableId,
    dto.status
  );

  return StandardApiResponse.success(
    updatedTable,
    'Table status updated successfully.'
  );
}

// DTO
export class UpdateTableStatusDto {
  @IsEnum(TableStatus)
  status: TableStatus;
}
```

#### Step 5: Event Hooks Integration

```typescript
// src/active-table-session/active-table-session.service.ts
constructor(
  private prisma: PrismaService,
  private authService: AuthService,
  private tableService: TableService, // Inject
) {}

async createSession(...): Promise<ActiveTableSession> {
  // ... existing logic

  // Trigger automatic state transition
  await this.tableService.handleSessionCreated(session.id);

  return session;
}

// src/order/order.service.ts
async createOrder(...): Promise<Order> {
  // ... existing logic

  // Trigger automatic state transition
  await this.tableService.handleOrderPlaced(order.id);

  return order;
}

// Similar hooks in:
// - OrderService.updateOrderStatus() → handleOrderCompleted()
// - PaymentService.recordPayment() → handlePaymentRecorded()
// - ActiveTableSessionService.closeSession() → handleSessionClosed()
```

#### Step 6: Frontend Table Dashboard

```typescript
// apps/restaurant-management-system/src/features/tables/components/TableStatusDashboard.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@repo/ui/components/badge';
import { Card } from '@repo/ui/components/card';
import { TableStatus } from '@repo/api/generated/types';

const STATUS_CONFIG: Record<TableStatus, { color: string; label: string }> = {
  VACANT: { color: 'bg-gray-500', label: 'Vacant' },
  SEATED: { color: 'bg-blue-500', label: 'Seated' },
  ORDERING: { color: 'bg-yellow-500', label: 'Ordering' },
  SERVED: { color: 'bg-orange-500', label: 'Served' },
  READY_TO_PAY: { color: 'bg-green-500', label: 'Ready to Pay' },
  CLEANING: { color: 'bg-purple-500', label: 'Cleaning' },
};

export function TableStatusDashboard({ storeId }: Props) {
  const { data: tables = [] } = useQuery({
    queryKey: ['tables', storeId],
    queryFn: () => getAllTables(storeId),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {tables.map((table) => {
        const config = STATUS_CONFIG[table.currentStatus];

        return (
          <Card
            key={table.id}
            className={`p-4 cursor-pointer hover:shadow-lg transition-shadow ${config.color}`}
            onClick={() => handleTableClick(table)}
          >
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">
                {table.name}
              </h3>
              <Badge variant="outline" className="mt-2 bg-white">
                {config.label}
              </Badge>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Status transition buttons
export function TableStatusActions({ table, storeId }: Props) {
  const mutation = useMutation({
    mutationFn: (newStatus: TableStatus) =>
      updateTableStatus(storeId, table.id, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', storeId] });
      toast.success('Table status updated');
    },
  });

  const validTransitions = VALID_TRANSITIONS[table.currentStatus];

  return (
    <div className="flex gap-2">
      {validTransitions.map((status) => (
        <Button
          key={status}
          onClick={() => mutation.mutate(status)}
          disabled={mutation.isPending}
        >
          {STATUS_CONFIG[status].label}
        </Button>
      ))}
    </div>
  );
}
```

#### Step 7: WebSocket Real-Time Updates (Optional Enhancement)

```typescript
// src/table/table.gateway.ts
@WebSocketGateway({ cors: true })
export class TableGateway {
  @WebSocketServer() server: Server;

  emitTableStatusUpdate(storeId: string, table: Table) {
    this.server
      .to(`store-${storeId}`)
      .emit('table:status-updated', table);
  }
}

// In TableService
constructor(
  private prisma: PrismaService,
  private authService: AuthService,
  private tableGateway: TableGateway, // Inject
) {}

async updateTableStatus(...): Promise<Table> {
  // ... existing logic

  // Emit WebSocket event
  this.tableGateway.emitTableStatusUpdate(storeId, updatedTable);

  return updatedTable;
}

// Frontend WebSocket listener
useEffect(() => {
  if (!socket) return;

  socket.on('table:status-updated', (table) => {
    queryClient.setQueryData(
      ['tables', storeId],
      (old: TableResponseDto[] = []) =>
        old.map((t) => (t.id === table.id ? table : t))
    );
  });

  return () => socket.off('table:status-updated');
}, [socket, storeId]);
```

---

## Frontend Implementation Guides

### 4. RMS Manual Order Creation (HIGH Priority)

**Estimated Effort**: 3 developer days

**Problem**: Staff cannot create orders manually (for phone orders, walk-ins, counter orders)

**Solution**: Create comprehensive order creation flow in RMS

#### Architecture Decision

**Option A**: Reuse cart flow (create temporary session)
**Option B**: Direct order creation (bypass cart)

**Recommendation**: **Option B** - Direct order creation

**Rationale**:
- Simpler UX for staff
- No session management overhead
- Clear separation from customer cart flow
- Can be completed faster

#### Step 1: Backend Endpoint Enhancement

```typescript
// src/order/dto/create-order-manual.dto.ts
export class CreateOrderManualDto {
  @IsString()
  @IsNotEmpty()
  tableName: string; // Can be table name OR "Counter" OR "Phone Order #123"

  @IsEnum(OrderType)
  orderType: OrderType; // DINE_IN, TAKEOUT, DELIVERY

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
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomizationDto)
  customizations?: CustomizationDto[];
}

export class CustomizationDto {
  @IsUUID()
  customizationOptionId: string;
}

// src/order/order.controller.ts
@Post('manual')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create order manually (OWNER/ADMIN/SERVER Required)' })
async createOrderManual(
  @Req() req: RequestWithUser,
  @Query('storeId', ParseUUIDPipe) storeId: string,
  @Body() dto: CreateOrderManualDto,
): Promise<StandardApiResponse<OrderResponseDto>> {
  const userId = req.user.sub;
  const order = await this.orderService.createOrderManual(
    userId,
    storeId,
    dto
  );

  return StandardApiResponse.success(order, 'Order created successfully.');
}
```

#### Step 2: Service Logic

```typescript
// src/order/order.service.ts
async createOrderManual(
  userId: string,
  storeId: string,
  dto: CreateOrderManualDto
): Promise<Order> {
  const method = this.createOrderManual.name;

  // RBAC check
  await this.authService.checkStorePermission(userId, storeId, [
    Role.OWNER,
    Role.ADMIN,
    Role.SERVER,
  ]);

  // Fetch menu items to validate and get prices
  const menuItemIds = dto.items.map((item) => item.menuItemId);
  const menuItems = await this.prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      storeId,
      deletedAt: null,
      isHidden: false,
    },
    include: {
      customizationGroups: {
        include: {
          customizationOptions: true,
        },
      },
    },
  });

  // Validate all items exist
  if (menuItems.length !== menuItemIds.length) {
    throw new NotFoundException('One or more menu items not found');
  }

  // Get store settings for VAT/service charge
  const storeSetting = await this.prisma.storeSetting.findUnique({
    where: { storeId },
  });

  // Calculate totals
  let subTotal = new Decimal(0);
  const orderItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];

  for (const itemDto of dto.items) {
    const menuItem = menuItems.find((mi) => mi.id === itemDto.menuItemId);
    if (!menuItem) continue;

    let itemTotal = new Decimal(menuItem.basePrice).mul(itemDto.quantity);

    // Add customization prices
    const customizationData: Prisma.OrderItemCustomizationCreateWithoutOrderItemInput[] = [];

    if (itemDto.customizations) {
      for (const custDto of itemDto.customizations) {
        const option = menuItem.customizationGroups
          .flatMap((g) => g.customizationOptions)
          .find((o) => o.id === custDto.customizationOptionId);

        if (option && option.additionalPrice) {
          itemTotal = itemTotal.add(
            new Decimal(option.additionalPrice).mul(itemDto.quantity)
          );

          customizationData.push({
            customizationOptionId: option.id,
            optionName: option.name,
            additionalPrice: option.additionalPrice,
          });
        }
      }
    }

    subTotal = subTotal.add(itemTotal);

    orderItemsData.push({
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      basePrice: menuItem.basePrice,
      quantity: itemDto.quantity,
      notes: itemDto.notes,
      customizations: {
        create: customizationData,
      },
    });
  }

  // Calculate VAT and service charge
  const vatRate = storeSetting?.vatRate || new Decimal(0);
  const serviceChargeRate = storeSetting?.serviceChargeRate || new Decimal(0);

  const vatAmount = subTotal.mul(vatRate);
  const serviceChargeAmount = subTotal.mul(serviceChargeRate);
  const grandTotal = subTotal.add(vatAmount).add(serviceChargeAmount);

  // Generate order number
  const orderNumber = await this.generateOrderNumber(storeId);

  // Create order in transaction
  const order = await this.prisma.$transaction(async (tx) => {
    return await tx.order.create({
      data: {
        orderNumber,
        storeId,
        tableName: dto.tableName,
        orderType: dto.orderType,
        status: OrderStatus.PENDING,
        subTotal,
        vatRateSnapshot: vatRate,
        serviceChargeRateSnapshot: serviceChargeRate,
        vatAmount,
        serviceChargeAmount,
        grandTotal,
        orderItems: {
          create: orderItemsData,
        },
      },
      include: {
        orderItems: {
          include: {
            customizations: true,
          },
        },
      },
    });
  });

  this.logger.log(
    `[${method}] Manual order ${order.orderNumber} created by User ${userId}`
  );

  return order;
}
```

#### Step 3: Frontend Order Creation Page

```typescript
// apps/restaurant-management-system/src/features/orders/components/ManualOrderForm.tsx
'use client';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Save } from 'lucide-react';
import Decimal from 'decimal.js';

const orderSchema = z.object({
  tableName: z.string().min(1, 'Table name required'),
  orderType: z.enum(['DINE_IN', 'TAKEOUT', 'DELIVERY']),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().min(1),
      notes: z.string().optional(),
      customizations: z.array(
        z.object({
          customizationOptionId: z.string().uuid(),
        })
      ).optional(),
    })
  ).min(1, 'At least one item required'),
});

type FormValues = z.infer<typeof orderSchema>;

export function ManualOrderForm({ storeId }: Props) {
  const t = useTranslations('orders');
  const [selectedItems, setSelectedItems] = useState<MenuItem[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      tableName: '',
      orderType: 'DINE_IN',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Calculate order total in real-time
  const calculateTotal = () => {
    let total = new Decimal(0);

    fields.forEach((field, index) => {
      const menuItem = selectedItems[index];
      if (!menuItem) return;

      const itemTotal = new Decimal(menuItem.basePrice)
        .mul(field.quantity);

      // Add customizations
      if (field.customizations) {
        field.customizations.forEach((cust) => {
          const option = findCustomizationOption(menuItem, cust.customizationOptionId);
          if (option?.additionalPrice) {
            total = total.add(
              new Decimal(option.additionalPrice).mul(field.quantity)
            );
          }
        });
      }

      total = total.add(itemTotal);
    });

    return total.toFixed(2);
  };

  const addMenuItem = (menuItem: MenuItem) => {
    append({
      menuItemId: menuItem.id,
      quantity: 1,
      notes: '',
      customizations: [],
    });
    setSelectedItems([...selectedItems, menuItem]);
  };

  const removeMenuItem = (index: number) => {
    remove(index);
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      createOrderManual(storeId, data),
    onSuccess: (order) => {
      toast.success(t('orderCreated', { orderNumber: order.orderNumber }));
      router.push(`/hub/orders/${order.id}`);
    },
    onError: (error) => {
      toast.error(error.message || t('orderFailed'));
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t('orderDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="tableName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tableName')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('tableNamePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('tableNameHelp')}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="orderType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('orderType')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DINE_IN">{t('dineIn')}</SelectItem>
                      <SelectItem value="TAKEOUT">{t('takeout')}</SelectItem>
                      <SelectItem value="DELIVERY">{t('delivery')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Menu Item Selection */}
        <Card>
          <CardHeader>
            <CardTitle>{t('selectItems')}</CardTitle>
          </CardHeader>
          <CardContent>
            <MenuItemPicker
              storeId={storeId}
              onSelect={addMenuItem}
            />
          </CardContent>
        </Card>

        {/* Selected Items */}
        {fields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('orderItems')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => {
                const menuItem = selectedItems[index];
                if (!menuItem) return null;

                return (
                  <div key={field.id} className="flex gap-4 p-4 border rounded-lg">
                    <img
                      src={menuItem.imageUrl || '/placeholder.png'}
                      alt={menuItem.name}
                      className="w-20 h-20 object-cover rounded"
                    />

                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold">{menuItem.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(menuItem.basePrice, 'THB')}
                      </p>

                      {/* Quantity */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('quantity')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Customizations */}
                      {menuItem.customizationGroups.length > 0 && (
                        <CustomizationPicker
                          menuItem={menuItem}
                          value={field.customizations || []}
                          onChange={(customizations) =>
                            form.setValue(`items.${index}.customizations`, customizations)
                          }
                        />
                      )}

                      {/* Notes */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.notes`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('notes')}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={t('notesPlaceholder')}
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => removeMenuItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        {fields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>{t('subtotal')}</span>
                  <span>{formatCurrency(calculateTotal(), 'THB')}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('taxesCalculatedAtCheckout')}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || fields.length === 0}
          >
            <Save className="mr-2 h-4 w-4" />
            {t('createOrder')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

#### Step 4: Menu Item Picker Component

```typescript
// apps/restaurant-management-system/src/features/orders/components/MenuItemPicker.tsx
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus } from 'lucide-react';
import { Input } from '@repo/ui/components/input';
import { Button } from '@repo/ui/components/button';

export function MenuItemPicker({ storeId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const t = useTranslations('menu');

  const { data: items = [] } = useQuery({
    queryKey: menuKeys.items(storeId),
    queryFn: () => getMenuItems(storeId),
  });

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchItems')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
        {filteredItems.map((item) => (
          <Card
            key={item.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onSelect(item)}
          >
            <CardContent className="p-4">
              <img
                src={item.imageUrl || '/placeholder.png'}
                alt={item.name}
                className="w-full h-32 object-cover rounded mb-2"
              />
              <h4 className="font-semibold">{item.name}</h4>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(item.basePrice, 'THB')}
              </p>
              <Button size="sm" className="w-full mt-2">
                <Plus className="mr-2 h-4 w-4" />
                {t('addItem')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

#### Step 5: Routes and Navigation

```typescript
// Add to apps/restaurant-management-system/src/common/constants/routes.ts
export const ROUTES = {
  // ... existing routes
  ORDERS_CREATE: '/hub/orders/create',
} as const;

// Create page at: src/app/[locale]/hub/orders/create/page.tsx
export default function CreateOrderPage() {
  const selectedStoreId = useAuthStore(selectSelectedStoreId);

  if (!selectedStoreId) {
    return <div>No store selected</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{t('createOrder')}</h1>
      <ManualOrderForm storeId={selectedStoreId} />
    </div>
  );
}

// Add navigation button in orders list page
<Button onClick={() => router.push(ROUTES.ORDERS_CREATE)}>
  <Plus className="mr-2 h-4 w-4" />
  {t('createOrder')}
</Button>
```

#### Step 6: i18n Additions (All 4 Languages)

```json
// messages/en.json
{
  "orders": {
    "createOrder": "Create Order",
    "orderCreated": "Order {orderNumber} created successfully",
    "orderFailed": "Failed to create order",
    "orderDetails": "Order Details",
    "tableName": "Table Name / Order ID",
    "tableNamePlaceholder": "e.g., Table 5, Counter Order #123, Phone Order",
    "tableNameHelp": "Enter table name for dine-in or custom ID for takeout/delivery",
    "orderType": "Order Type",
    "dineIn": "Dine In",
    "takeout": "Takeout",
    "delivery": "Delivery",
    "selectItems": "Select Menu Items",
    "orderItems": "Order Items",
    "quantity": "Quantity",
    "notes": "Special Instructions",
    "notesPlaceholder": "No onions, extra spicy, etc.",
    "orderSummary": "Order Summary",
    "subtotal": "Subtotal",
    "taxesCalculatedAtCheckout": "Taxes and service charges will be calculated",
    "cancel": "Cancel",
    "searchItems": "Search menu items...",
    "addItem": "Add to Order"
  }
}
```

---

## Complex Features (Multi-Day)

### 5. Bill Splitting (HIGH Priority, Complex)

**Estimated Effort**: 3-4 developer days

**Complexity**: HIGH (requires backend refactoring)

**Problem**: Orders support only single payment. Need to support multiple partial payments.

**Solution Options**:

**Option A**: Split-by-Item (Each diner pays for their items)
- Pros: Precise allocation, clear ownership
- Cons: Complex UI, requires item assignment

**Option B**: Split-by-Amount (Equal or custom splits)
- Pros: Simpler UX
- Cons: Less precise, may not match item ownership

**Recommendation**: **Implement both options** (tabbed interface)

#### Architecture Decision: Payment Allocation Model

**Current State**:
```
Order (1) → Payment (1)
```

**Proposed State**:
```
Order (1) → Payments (N)
  Each Payment has:
  - amount
  - amountTendered (cash)
  - paymentMethod
  - notes
```

**Key Insight**: The existing Payment model already supports multiple payments per order! The `Payment.amount` field can be less than `Order.grandTotal`.

**What's Missing**: Frontend UI + validation logic to ensure full payment.

#### Step 1: Backend Validation Enhancement

```typescript
// src/payment/payment.service.ts

async validatePaymentCompletion(orderId: string): Promise<{
  isPaidInFull: boolean;
  totalPaid: Decimal;
  remaining: Decimal;
}> {
  const order = await this.prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: true },
  });

  const totalPaid = order.payments.reduce(
    (sum, p) => sum.add(new Decimal(p.amount)),
    new Decimal(0)
  );

  const remaining = new Decimal(order.grandTotal).minus(totalPaid);
  const isPaidInFull = remaining.lessThanOrEqualTo(0);

  return {
    isPaidInFull,
    totalPaid,
    remaining,
  };
}

async recordPayment(
  userId: string,
  orderId: string,
  dto: RecordPaymentDto
): Promise<Payment> {
  // ... existing validation

  // Check if adding this payment would overpay
  const { totalPaid, remaining } = await this.validatePaymentCompletion(orderId);
  const amount = new Decimal(dto.amount);

  if (amount.greaterThan(remaining)) {
    throw new BadRequestException(
      `Payment amount (${amount}) exceeds remaining balance (${remaining})`
    );
  }

  // ... create payment

  // Check if order is now paid in full
  const { isPaidInFull } = await this.validatePaymentCompletion(orderId);

  if (isPaidInFull) {
    await this.prisma.order.update({
      where: { id: orderId },
      data: { paidAt: new Date() },
    });

    this.logger.log(`[${method}] Order ${orderId} paid in full`);
  }

  return payment;
}

// New endpoint: Get payment status
async getPaymentStatus(orderId: string) {
  const result = await this.validatePaymentCompletion(orderId);

  const order = await this.prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: true },
  });

  return {
    order: {
      id: order.id,
      grandTotal: order.grandTotal.toString(),
    },
    payments: order.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      paymentMethod: p.paymentMethod,
      createdAt: p.createdAt,
    })),
    summary: {
      isPaidInFull: result.isPaidInFull,
      totalPaid: result.totalPaid.toString(),
      remaining: result.remaining.toString(),
    },
  };
}
```

#### Step 2: Controller Endpoint

```typescript
// src/payment/payment.controller.ts

@Get('orders/:orderId/payment-status')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@ApiOperation({ summary: 'Get payment status for an order' })
async getPaymentStatus(
  @Param('orderId', ParseUUIDPipe) orderId: string,
): Promise<StandardApiResponse<PaymentStatusDto>> {
  const status = await this.paymentService.getPaymentStatus(orderId);
  return StandardApiResponse.success(status, 'Payment status retrieved');
}
```

#### Step 3: Frontend Bill Splitting UI

```typescript
// apps/restaurant-management-system/src/features/payment/components/BillSplitModal.tsx
'use client';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@repo/ui/components/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import Decimal from 'decimal.js';

export function BillSplitModal({ order, isOpen, onClose }: Props) {
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom' | 'item'>('equal');
  const t = useTranslations('payment.split');

  // Fetch payment status
  const { data: paymentStatus } = useQuery({
    queryKey: ['payment-status', order.id],
    queryFn: () => getPaymentStatus(order.id),
    enabled: isOpen,
  });

  const remaining = paymentStatus?.summary.remaining || order.grandTotal;
  const isPaidInFull = paymentStatus?.summary.isPaidInFull || false;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('splitBill')}</DialogTitle>
        </DialogHeader>

        {/* Payment Status */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>{t('totalBill')}</span>
                <span className="font-bold">
                  {formatCurrency(order.grandTotal, 'THB')}
                </span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>{t('paidSoFar')}</span>
                <span className="font-bold">
                  {formatCurrency(paymentStatus?.summary.totalPaid || '0', 'THB')}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>{t('remaining')}</span>
                <span className="text-orange-600">
                  {formatCurrency(remaining, 'THB')}
                </span>
              </div>
            </div>

            {isPaidInFull && (
              <div className="mt-4 p-3 bg-green-100 text-green-800 rounded">
                {t('billPaidInFull')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Split Methods */}
        {!isPaidInFull && (
          <Tabs value={splitMethod} onValueChange={(v) => setSplitMethod(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="equal">{t('splitEqually')}</TabsTrigger>
              <TabsTrigger value="custom">{t('customAmounts')}</TabsTrigger>
              <TabsTrigger value="item">{t('splitByItem')}</TabsTrigger>
            </TabsList>

            <TabsContent value="equal">
              <SplitEquallyForm
                order={order}
                remaining={remaining}
                onSuccess={onClose}
              />
            </TabsContent>

            <TabsContent value="custom">
              <SplitCustomForm
                order={order}
                remaining={remaining}
                onSuccess={onClose}
              />
            </TabsContent>

            <TabsContent value="item">
              <SplitByItemForm
                order={order}
                remaining={remaining}
                onSuccess={onClose}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Payment History */}
        {paymentStatus && paymentStatus.payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('paymentHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {paymentStatus.payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between text-sm">
                    <span>
                      {payment.paymentMethod} •{' '}
                      {new Date(payment.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(payment.amount, 'THB')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

#### Step 4: Split Equally Form

```typescript
// apps/restaurant-management-system/src/features/payment/components/SplitEquallyForm.tsx
export function SplitEquallyForm({ order, remaining, onSuccess }: Props) {
  const [numSplits, setNumSplits] = useState(2);
  const t = useTranslations('payment.split');

  const amountPerPerson = new Decimal(remaining).div(numSplits).toFixed(2);

  const handleRecordPayment = async (index: number) => {
    try {
      await recordPayment(order.id, {
        amount: amountPerPerson,
        paymentMethod: PaymentMethod.CASH,
        notes: `Split payment ${index + 1} of ${numSplits}`,
      });

      toast.success(t('paymentRecorded', { index: index + 1 }));

      // Check if this was the last payment
      if (index === numSplits - 1) {
        onSuccess?.();
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>{t('numPeople')}</Label>
        <Input
          type="number"
          min={2}
          max={20}
          value={numSplits}
          onChange={(e) => setNumSplits(parseInt(e.target.value))}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">{t('amountPerPerson')}</div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(amountPerPerson, 'THB')}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {Array.from({ length: numSplits }).map((_, index) => (
          <Button
            key={index}
            variant="outline"
            className="w-full"
            onClick={() => handleRecordPayment(index)}
          >
            {t('recordPayment', { index: index + 1 })}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

#### Step 5: Split By Item Form (Advanced)

```typescript
// apps/restaurant-management-system/src/features/payment/components/SplitByItemForm.tsx
export function SplitByItemForm({ order, remaining, onSuccess }: Props) {
  const [itemAssignments, setItemAssignments] = useState<Record<string, number>>({});
  const [numDiners, setNumDiners] = useState(2);
  const t = useTranslations('payment.split');

  // Calculate amount per diner
  const dinerTotals = useMemo(() => {
    const totals: Record<number, Decimal> = {};

    for (let i = 0; i < numDiners; i++) {
      totals[i] = new Decimal(0);
    }

    order.orderItems.forEach((item) => {
      const assignedDiner = itemAssignments[item.id];
      if (assignedDiner !== undefined && totals[assignedDiner]) {
        const itemTotal = new Decimal(item.basePrice).mul(item.quantity);
        // Add customizations
        item.customizations.forEach((cust) => {
          if (cust.additionalPrice) {
            itemTotal = itemTotal.add(
              new Decimal(cust.additionalPrice).mul(item.quantity)
            );
          }
        });

        totals[assignedDiner] = totals[assignedDiner].add(itemTotal);
      }
    });

    // Add proportional tax and service charge
    const subtotal = order.subTotal;
    const taxAndService = new Decimal(order.vatAmount)
      .add(new Decimal(order.serviceChargeAmount));

    Object.keys(totals).forEach((dinerKey) => {
      const diner = parseInt(dinerKey);
      if (totals[diner].greaterThan(0)) {
        const proportion = totals[diner].div(subtotal);
        const dinerTax = taxAndService.mul(proportion);
        totals[diner] = totals[diner].add(dinerTax);
      }
    });

    return totals;
  }, [itemAssignments, order, numDiners]);

  const allItemsAssigned = order.orderItems.every(
    (item) => itemAssignments[item.id] !== undefined
  );

  return (
    <div className="space-y-4">
      <div>
        <Label>{t('numDiners')}</Label>
        <Input
          type="number"
          min={2}
          max={10}
          value={numDiners}
          onChange={(e) => {
            setNumDiners(parseInt(e.target.value));
            setItemAssignments({}); // Reset assignments
          }}
        />
      </div>

      {/* Item Assignment */}
      <div className="space-y-2">
        <h4 className="font-semibold">{t('assignItems')}</h4>
        {order.orderItems.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{item.menuItemName}</p>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity} •{' '}
                    {formatCurrency(item.basePrice, 'THB')} each
                  </p>
                </div>

                <Select
                  value={itemAssignments[item.id]?.toString()}
                  onValueChange={(v) =>
                    setItemAssignments({
                      ...itemAssignments,
                      [item.id]: parseInt(v),
                    })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={t('selectDiner')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: numDiners }).map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {t('diner', { number: i + 1 })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Diner Totals */}
      {allItemsAssigned && (
        <Card>
          <CardHeader>
            <CardTitle>{t('dinerTotals')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(dinerTotals).map(([dinerKey, total]) => {
              const diner = parseInt(dinerKey);
              if (total.lessThanOrEqualTo(0)) return null;

              return (
                <div key={diner} className="flex justify-between items-center">
                  <span className="font-medium">
                    {t('diner', { number: diner + 1 })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {formatCurrency(total.toFixed(2), 'THB')}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleDinerPayment(diner, total.toFixed(2))}
                    >
                      {t('pay')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!allItemsAssigned && (
        <div className="text-sm text-orange-600">
          {t('assignAllItems')}
        </div>
      )}
    </div>
  );
}
```

#### Step 6: Test Cases

```typescript
// src/payment/payment.service.spec.ts
describe('Bill Splitting', () => {
  it('should allow multiple partial payments', async () => {
    const order = {
      id: 'order-1',
      grandTotal: new Decimal('100.00'),
    };

    // First payment (50%)
    await service.recordPayment('user-1', 'order-1', {
      amount: '50.00',
      paymentMethod: PaymentMethod.CASH,
    });

    // Second payment (50%)
    await service.recordPayment('user-1', 'order-1', {
      amount: '50.00',
      paymentMethod: PaymentMethod.CREDIT_CARD,
    });

    const status = await service.validatePaymentCompletion('order-1');
    expect(status.isPaidInFull).toBe(true);
    expect(status.totalPaid.toString()).toBe('100.00');
  });

  it('should reject overpayment', async () => {
    const order = {
      id: 'order-1',
      grandTotal: new Decimal('100.00'),
    };

    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      ...order,
      payments: [{ amount: new Decimal('80.00') }],
    });

    // Try to pay 30 when only 20 is remaining
    await expect(
      service.recordPayment('user-1', 'order-1', {
        amount: '30.00',
        paymentMethod: PaymentMethod.CASH,
      })
    ).rejects.toThrow('exceeds remaining balance');
  });
});
```

---

### 6. Refund/Void UI (HIGH Priority)

**Estimated Effort**: 2 developer days

**Backend**: Already exists (`POST /payments/orders/:orderId/refunds`)

**Frontend**: Missing UI

#### Implementation

```typescript
// apps/restaurant-management-system/src/features/orders/components/RefundVoidDialog.tsx
'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@repo/ui/components/tabs';

export function RefundVoidDialog({ order, isOpen, onClose }: Props) {
  const [action, setAction] = useState<'refund' | 'void'>('void');
  const t = useTranslations('orders.refundVoid');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <Tabs value={action} onValueChange={(v) => setAction(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="void">{t('voidOrder')}</TabsTrigger>
            <TabsTrigger value="refund" disabled={!order.paidAt}>
              {t('refundPayment')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="void">
            <VoidOrderForm order={order} onSuccess={onClose} />
          </TabsContent>

          <TabsContent value="refund">
            <RefundPaymentForm order={order} onSuccess={onClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Void Order Form (Cancel before payment)
export function VoidOrderForm({ order, onSuccess }: Props) {
  const form = useForm({
    defaultValues: {
      reason: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (reason: string) => cancelOrder(order.id, reason),
    onSuccess: () => {
      toast.success(t('orderVoided'));
      onSuccess?.();
    },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data.reason))}>
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('voidWarning')}</AlertDescription>
        </Alert>

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('reason')}</FormLabel>
              <Select onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectReason')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_request">{t('customerRequest')}</SelectItem>
                  <SelectItem value="wrong_order">{t('wrongOrder')}</SelectItem>
                  <SelectItem value="kitchen_issue">{t('kitchenIssue')}</SelectItem>
                  <SelectItem value="other">{t('other')}</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <Button type="submit" variant="destructive" className="w-full">
          {t('voidOrder')}
        </Button>
      </div>
    </form>
  );
}

// Refund Payment Form
export function RefundPaymentForm({ order, onSuccess }: Props) {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');

  const form = useForm({
    defaultValues: {
      amount: order.grandTotal,
      reason: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: { amount: string; reason: string }) =>
      issueRefund(order.id, data),
    onSuccess: () => {
      toast.success(t('refundIssued'));
      onSuccess?.();
    },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('refundType')}</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={refundType === 'full' ? 'default' : 'outline'}
              onClick={() => {
                setRefundType('full');
                form.setValue('amount', order.grandTotal);
              }}
            >
              {t('fullRefund')}
            </Button>
            <Button
              type="button"
              variant={refundType === 'partial' ? 'default' : 'outline'}
              onClick={() => setRefundType('partial')}
            >
              {t('partialRefund')}
            </Button>
          </div>
        </div>

        {refundType === 'partial' && (
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('refundAmount')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0.01}
                    max={order.grandTotal}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('reason')}</FormLabel>
              <Textarea placeholder={t('reasonPlaceholder')} {...field} />
            </FormItem>
          )}
        />

        <Button type="submit" variant="destructive" className="w-full">
          {t('issueRefund')} {formatCurrency(form.watch('amount'), 'THB')}
        </Button>
      </div>
    </form>
  );
}
```

---

### 7. Reports Dashboard (HIGH Priority)

**Estimated Effort**: 3 developer days

**Backend**: APIs exist (`/reports/*`)

**Frontend**: Missing UI

#### Implementation

```typescript
// apps/restaurant-management-system/src/features/reports/components/ReportsDashboard.tsx
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { DatePickerWithRange } from '@repo/ui/components/date-range-picker';
import { Download } from 'lucide-react';

export function ReportsDashboard({ storeId }: Props) {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const t = useTranslations('reports');

  // Fetch all reports
  const { data: salesSummary } = useQuery({
    queryKey: ['reports', 'sales-summary', storeId, dateRange],
    queryFn: () => getSalesSummary(storeId, dateRange.from, dateRange.to),
  });

  const { data: topItems } = useQuery({
    queryKey: ['reports', 'top-items', storeId, dateRange],
    queryFn: () => getTopItems(storeId, dateRange.from, dateRange.to),
  });

  const { data: paymentBreakdown } = useQuery({
    queryKey: ['reports', 'payment-breakdown', storeId, dateRange],
    queryFn: () => getPaymentBreakdown(storeId, dateRange.from, dateRange.to),
  });

  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <DatePickerWithRange
              value={dateRange}
              onChange={setDateRange}
            />

            <Button variant="outline" onClick={() => exportAllReports()}>
              <Download className="mr-2 h-4 w-4" />
              {t('exportCSV')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sales Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('totalRevenue')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(salesSummary?.totalRevenue || '0', 'THB')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('totalOrders')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {salesSummary?.totalOrders || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('averageOrderValue')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(salesSummary?.averageOrderValue || '0', 'THB')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Items Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('topSellingItems')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TopItemsChart data={topItems} />
        </CardContent>
      </Card>

      {/* Payment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t('paymentMethods')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentBreakdownChart data={paymentBreakdown} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Shared Patterns

### Error Toast Notifications

```typescript
// Standard error handling
try {
  await mutation.mutateAsync(data);
  toast.success(t('success'));
} catch (error) {
  const message = error instanceof Error ? error.message : t('unknownError');
  toast.error(message);
}
```

### Loading Skeletons

```typescript
if (isLoading) {
  return <YourFeatureSkeleton />;
}

// Create skeleton component
export function YourFeatureSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

### Confirmation Dialogs

```typescript
// Use AlertDialog from @repo/ui
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">{t('delete')}</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
      <AlertDialogDescription>
        {t('deleteWarning')}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>
        {t('delete')}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Number Formatting

```typescript
// Currency
formatCurrency(value, 'THB', 'th-TH'); // From utils/formatting.ts

// Client-side Decimal calculations
import Decimal from 'decimal.js';

const total = new Decimal(basePrice)
  .mul(quantity)
  .add(new Decimal(taxAmount))
  .toFixed(2);
```

### Date Formatting

```typescript
// Use Intl.DateTimeFormat
const formatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatted = formatter.format(new Date(order.createdAt));
```

---

## Testing Implementation

### Backend Unit Test Example (Routing Areas)

```typescript
// src/kitchen/kitchen.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { createPrismaMock } from '../common/testing/prisma-mock.helper';

describe('KitchenService', () => {
  let service: KitchenService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KitchenService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<KitchenService>(KitchenService);
  });

  describe('getKitchenOrders with routing area', () => {
    it('should return only GRILL orders', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderItems: [
            {
              id: 'item-1',
              menuItem: { routingArea: RoutingArea.GRILL, name: 'Steak' },
            },
          ],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getKitchenOrders(
        'user-1',
        'store-1',
        RoutingArea.GRILL
      );

      expect(result).toHaveLength(1);
      expect(result[0].orderItems[0].menuItem.routingArea).toBe(RoutingArea.GRILL);
    });
  });
});
```

### Frontend Component Test Example (QR Code UI)

```typescript
// apps/restaurant-management-system/src/app/[locale]/hub/(owner-admin)/tables/qr-code/__tests__/page.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TableQrCodePage from '../page';

jest.mock('@/features/tables/services/table.service', () => ({
  getAllTables: jest.fn(() =>
    Promise.resolve([
      { id: 'table-1', name: 'Table 1' },
      { id: 'table-2', name: 'Table 2' },
    ])
  ),
}));

describe('TableQrCodePage', () => {
  it('should render QR codes for all tables', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <TableQrCodePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeInTheDocument();
      expect(screen.getByText('Table 2')).toBeInTheDocument();
    });
  });

  it('should show print all button', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <TableQrCodePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Print All')).toBeInTheDocument();
    });
  });
});
```

---

## Code Review Checklist

Use this checklist for every feature implementation:

### Backend

- [ ] RBAC checks implemented (checkStorePermission)
- [ ] Store isolation enforced (WHERE storeId = ?)
- [ ] Soft deletes filtered (WHERE deletedAt IS NULL)
- [ ] Decimal strings used (not floats)
- [ ] Transactions used for multi-step writes
- [ ] Error handling with specific exceptions
- [ ] Logging with method name and context
- [ ] DTOs validated with decorators
- [ ] Prisma errors mapped to HTTP exceptions
- [ ] Test coverage 85%+
- [ ] Session validation (if cart/session related)
- [ ] ConfigService used (not process.env)

### Frontend

- [ ] Auto-generated types from @repo/api used
- [ ] @repo/ui components used (not recreated)
- [ ] Query key factories used
- [ ] Optimistic updates (if needed)
- [ ] Loading skeletons implemented
- [ ] Error toast notifications
- [ ] Success feedback provided
- [ ] i18n complete (all 4 languages)
- [ ] Form validation with Zod
- [ ] Confirmation dialogs for destructive actions
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility (keyboard navigation, ARIA labels)
- [ ] Type safety (no `any` types)

### Integration

- [ ] Types regenerated (npm run generate:api)
- [ ] Backend API tested manually
- [ ] Frontend form tested with valid/invalid data
- [ ] Error scenarios tested
- [ ] Edge cases handled
- [ ] Performance checked (large datasets)
- [ ] Security validated (unauthorized access blocked)

---

## Performance Considerations

### Backend

**Database Indexes**:
- Add indexes for `WHERE` clauses: `@@index([storeId, currentStatus])`
- Add indexes for `ORDER BY`: `@@index([storeId, createdAt])`
- Add composite indexes for frequent queries

**Query Optimization**:
- Use `select` to fetch only needed fields
- Use `include` carefully (N+1 problem)
- Paginate large result sets
- Use `Promise.all` for concurrent reads

**Caching**:
- Cache rarely-changing data (menu items, categories)
- Use Redis for session data (if scaling beyond single server)

### Frontend

**React Query**:
- Set appropriate `staleTime` (1 minute default)
- Use `gcTime` to control cache retention (30 minutes default)
- Implement infinite queries for long lists

**Code Splitting**:
- Dynamic imports for large components
- Route-based splitting (Next.js does this automatically)

**Image Optimization**:
- Use Next.js Image component
- Serve WebP format with PNG/JPG fallback
- Lazy load images below the fold

---

## Database Migration Strategy

### Order of Migrations

1. **Non-Breaking Changes First** (can be deployed independently):
   - `preparationTimeMinutes` (nullable)
   - `amountTendered` (nullable)
   - `routingArea` (has default value)

2. **Table State** (may affect active sessions):
   - `currentStatus` (has default, but may need backfill)
   - Run migration during low-traffic window

3. **Data Backfill** (if needed):
   - Assign routing areas to existing menu items
   - Set table statuses based on current sessions

### Rollback Plan

**Before deploying**:
```bash
# Create backup
pg_dump origin_food_house > backup_$(date +%Y%m%d_%H%M%S).sql
```

**If issues arise**:
```bash
# Rollback migration
npx prisma migrate resolve --rolled-back 20250123_add_routing_area

# Restore backup (last resort)
psql origin_food_house < backup_20250123_120000.sql
```

### Backwards Compatibility

All migrations are **backwards compatible**:
- New fields are nullable OR have default values
- Old code will continue working
- Frontend can deploy after backend (types will match)

---

## API Integration Patterns

### Type-Safe Fetch

```typescript
// Service function template
export async function yourApiFunction(
  storeId: string,
  data: YourDto
): Promise<YourResponseDto> {
  const res = await apiFetch<YourResponseDto>({
    path: '/your-endpoint',
    method: 'POST',
    query: { storeId },
    body: JSON.stringify(data),
  });

  return unwrapData(res, 'Failed to perform action');
}
```

### Error Handling Pattern

```typescript
// Service layer (catches API errors)
try {
  return await apiFetch<ResponseDto>({ ... });
} catch (error) {
  // error is already typed from apiFetch
  if (error.statusCode === 403) {
    throw new Error(t('permissionDenied'));
  }
  throw error; // Re-throw for component to handle
}

// Component layer (displays user feedback)
const mutation = useMutation({
  mutationFn: yourApiFunction,
  onSuccess: () => {
    toast.success(t('success'));
    queryClient.invalidateQueries({ queryKey: yourKeys.all });
  },
  onError: (error) => {
    toast.error(error.message || t('unknownError'));
  },
});
```

### Loading State Pattern

```typescript
// Skeleton during initial load
if (isLoading) return <YourSkeleton />;

// Spinner during mutation
<Button disabled={mutation.isPending}>
  {mutation.isPending && <Spinner className="mr-2" />}
  {t('submit')}
</Button>
```

### Optimistic Updates Pattern

```typescript
const mutation = useMutation({
  mutationFn: updateData,
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: yourKeys.item(id) });

    // Snapshot previous value
    const previous = queryClient.getQueryData(yourKeys.item(id));

    // Optimistically update
    queryClient.setQueryData(yourKeys.item(id), newData);

    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(yourKeys.item(id), context.previous);
    toast.error(err.message);
  },
  onSettled: () => {
    // Refetch to ensure sync
    queryClient.invalidateQueries({ queryKey: yourKeys.item(id) });
  },
});
```

### Query Key Factories

```typescript
// Hierarchical structure
export const yourKeys = {
  all: ['your-feature'] as const,
  lists: () => [...yourKeys.all, 'list'] as const,
  list: (storeId: string, filters: Filters) =>
    [...yourKeys.lists(), { storeId, ...filters }] as const,
  details: () => [...yourKeys.all, 'detail'] as const,
  detail: (id: string) => [...yourKeys.details(), id] as const,
};

// Usage
queryClient.invalidateQueries({ queryKey: yourKeys.all }); // Invalidate everything
queryClient.invalidateQueries({ queryKey: yourKeys.lists() }); // Invalidate all lists
queryClient.invalidateQueries({ queryKey: yourKeys.list(storeId, filters) }); // Specific list
```

---

## Common Pitfalls to Avoid

### Backend

1. **Missing Store Isolation**:
   ```typescript
   // ❌ Wrong
   const items = await prisma.menuItem.findMany();

   // ✅ Correct
   const items = await prisma.menuItem.findMany({
     where: { storeId, deletedAt: null },
   });
   ```

2. **Floating Point for Money**:
   ```typescript
   // ❌ Wrong
   const price = new Prisma.Decimal(9.99); // Precision errors!

   // ✅ Correct
   const price = new Prisma.Decimal('9.99');
   ```

3. **Direct process.env**:
   ```typescript
   // ❌ Wrong
   const apiKey = process.env.API_KEY;

   // ✅ Correct
   const apiKey = this.configService.get<string>('API_KEY');
   ```

4. **Missing Transaction**:
   ```typescript
   // ❌ Wrong (can leave inconsistent state)
   await prisma.order.create({ ... });
   await prisma.orderItem.create({ ... });

   // ✅ Correct
   await prisma.$transaction(async (tx) => {
     const order = await tx.order.create({ ... });
     await tx.orderItem.create({ orderId: order.id, ... });
   });
   ```

### Frontend

1. **Recreating @repo/ui Components**:
   ```typescript
   // ❌ Wrong
   export function MyButton() { ... } // Button already exists!

   // ✅ Correct
   import { Button } from '@repo/ui/components/button';
   ```

2. **Manual API Types**:
   ```typescript
   // ❌ Wrong
   interface MenuItem {
     id: string;
     name: string;
     // ...manually defined
   }

   // ✅ Correct
   import type { MenuItemResponseDto } from '@repo/api/generated/types';
   ```

3. **Hardcoded Strings**:
   ```typescript
   // ❌ Wrong
   <button>Save</button>

   // ✅ Correct
   const t = useTranslations('common');
   <button>{t('save')}</button>
   ```

4. **Forgetting Query Invalidation**:
   ```typescript
   // ❌ Wrong
   await createItem(data);
   // UI won't update!

   // ✅ Correct
   await createItem(data);
   queryClient.invalidateQueries({ queryKey: menuKeys.items(storeId) });
   ```

5. **Missing i18n Languages**:
   ```json
   // ❌ Wrong (only English)
   // messages/en.json: { "save": "Save" }

   // ✅ Correct (all 4 languages)
   // messages/en.json: { "save": "Save" }
   // messages/zh.json: { "save": "保存" }
   // messages/my.json: { "save": "သိမ်းမည်" }
   // messages/th.json: { "save": "บันทึก" }
   ```

---

## Summary

This implementation guide provides step-by-step instructions for completing Release Slice A. Key takeaways:

**Critical Discovery**: QR Code Generation UI is already complete - removing the only CRITICAL blocker!

**Revised Priority Order**:
1. Routing Areas (Backend + Frontend) - 1 day
2. Change Calculation (Backend + Frontend) - 0.5 days
3. Manual Order Creation (Frontend) - 3 days
4. Bill Splitting (Complex) - 3-4 days
5. Payment Recording UI (Frontend) - 2 days
6. Refund/Void UI (Frontend) - 2 days
7. Reports Dashboard (Frontend) - 3 days
8. Table State Management (Backend + Frontend) - 1 day

**Quick Wins** (< 1 day each):
- Preparation Times field - 0.5 days
- Quick "86" toggle - 0.5 days

**Total Effort**: ~12-15 developer days (down from 15-20 days)

**Key Patterns**:
- Backend: RBAC checks, store isolation, soft deletes, Decimal strings, transactions
- Frontend: Auto-generated types, @repo/ui components, React Query patterns, i18n
- Security: Session validation, ConfigService, permission checks
- Testing: 85%+ coverage on critical modules

**Next Steps**:
1. Prioritize features with stakeholders
2. Assign developers to tasks
3. Create feature branches
4. Implement in priority order
5. Test thoroughly before merging
6. Deploy incrementally (backend first, then frontend)

For detailed code examples and patterns, refer to specific sections above.

---

**Document End**
