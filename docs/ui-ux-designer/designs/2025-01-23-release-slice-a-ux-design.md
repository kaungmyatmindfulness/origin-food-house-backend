# Release Slice A - UX Design Specifications

**Date**: January 23, 2025
**Agent**: UI/UX Designer
**App**: Restaurant Management System (RMS)
**Type**: Design Specifications
**Status**: Draft
**Priority**: Critical for MVP Completion

---

## Executive Summary

This document provides comprehensive UX design specifications for 7 missing features in Release Slice A, focusing on the critical blocker (QR Code Generation UI) and high-priority staff workflows. All designs leverage the existing `@repo/ui` component library and follow established design patterns from the Origin Food House platform.

**Scope**: RMS App (Staff Interface - Port 3002)

**Features Covered**:
1. QR Code Generation & Management (CRITICAL BLOCKER)
2. Manual Order Creation
3. Payment Recording UI
4. Bill Splitting
5. Refund/Void UI
6. Reports Dashboard
7. Table State Dashboard

---

## Table of Contents

1. [Design System Reference](#design-system-reference)
2. [Critical Blocker: QR Code Generation UI](#1-critical-blocker-qr-code-generation-ui)
3. [Manual Order Creation](#2-manual-order-creation)
4. [Payment Recording UI](#3-payment-recording-ui)
5. [Bill Splitting](#4-bill-splitting)
6. [Refund/Void UI](#5-refundvoid-ui)
7. [Reports Dashboard](#6-reports-dashboard)
8. [Table State Dashboard](#7-table-state-dashboard)
9. [Accessibility Guidelines](#accessibility-guidelines)
10. [Multi-Language Considerations](#multi-language-considerations)

---

## Design System Reference

### Available @repo/ui Components

**Core Components**:
- Button, Input, Label, Textarea, Select, Checkbox, RadioGroup, Switch
- Form (react-hook-form integration)
- Card, Badge, Avatar, Separator
- Dialog, AlertDialog, ConfirmationDialog, Sheet, Drawer
- Table, Pagination
- Tabs, Accordion, Collapsible
- Calendar, Combobox, Command
- Spinner, Skeleton, Progress
- Toast (Sonner), Alert
- Chart (Recharts integration)
- Empty (empty state component)

### Design Tokens

**Spacing Scale** (Tailwind): 4, 8, 12, 16, 24, 32, 48, 64px
**Typography**:
- Headings: text-2xl (24px), text-xl (20px), text-lg (18px)
- Body: text-base (16px), text-sm (14px)
- Weights: font-normal (400), font-medium (500), font-semibold (600), font-bold (700)

**Colors** (Semantic):
- Primary: Restaurant brand color
- Secondary: Muted accent
- Destructive: Red (errors, deletes)
- Success: Green (confirmations)
- Warning: Yellow/Orange (alerts)
- Muted: Gray (disabled, secondary info)

**Responsive Breakpoints**:
- Mobile: 320px+
- Tablet: 768px+
- Desktop: 1024px+
- Large Desktop: 1280px+

---

## 1. Critical Blocker: QR Code Generation UI

**Location**: `/hub/(owner-admin)/tables` (existing page, enhancement)
**Users**: Owner, Admin
**Priority**: CRITICAL (Blocker for table-based ordering)

### 1.1 User Goals

- Generate printable QR codes for all tables
- Download QR codes individually or in bulk
- Print QR codes with clear table identification
- Regenerate QR codes if needed
- Preview QR codes before printing

### 1.2 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    QR Code Generation Flow                   │
└─────────────────────────────────────────────────────────────┘

OWNER/ADMIN on Tables Page
    │
    ├─> Views list of tables with inline QR preview
    │   │
    │   ├─> Single Table Actions:
    │   │   ├─> Click "View QR" → Opens QR dialog
    │   │   ├─> Click "Download" → Downloads PNG
    │   │   └─> Click "Print" → Opens print preview
    │   │
    │   └─> Bulk Actions:
    │       ├─> Click "Print All QR Codes" → Batch print preview
    │       └─> Click "Download All" → ZIP file download
    │
    └─> QR Code Dialog (Single Table)
        │
        ├─> Display: Large QR code, table name, store name
        ├─> Format Options: Size (small/medium/large)
        ├─> Actions: Download PNG, Download PDF, Print
        └─> Close dialog
```

### 1.3 Component Specifications

#### Tables Page Enhancement

**Layout**: Existing table list with added QR column

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tables                                          [+ Create Table]  [⋮]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌────────┬────────┬────────────┬───────────────┬───────────────────┐  │
│ │ QR     │ Name   │ Capacity   │ Status        │ Actions           │  │
│ ├────────┼────────┼────────────┼───────────────┼───────────────────┤  │
│ │ [QR]   │ T-01   │ 4 seats    │ 🟢 Vacant     │ [Edit] [View QR]  │  │
│ │        │        │            │               │ [Download] [Print]│  │
│ ├────────┼────────┼────────────┼───────────────┼───────────────────┤  │
│ │ [QR]   │ T-02   │ 6 seats    │ 🔴 Occupied   │ [Edit] [View QR]  │  │
│ │        │        │            │               │ [Download] [Print]│  │
│ └────────┴────────┴────────────┴───────────────┴───────────────────┘  │
│                                                                         │
│ [Print All QR Codes]  [Download All (ZIP)]                             │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Card` (page container)
- `Table` (data table)
- `Button` (actions, bulk operations)
- `Badge` (status indicators)
- `DropdownMenu` (kebab menu for bulk actions)

**New Components Needed**:
- `QRCodeThumbnail` (32x32px inline preview)

#### QR Code Dialog

**Trigger**: Click "View QR" button on any table row

```
┌──────────────────────────────────────────────────────────────┐
│  QR Code - Table T-01                              [✕] Close │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│                     ┌───────────────┐                        │
│                     │               │                        │
│                     │   QR CODE     │  <- 256x256px         │
│                     │   (Large)     │                        │
│                     │               │                        │
│                     └───────────────┘                        │
│                                                               │
│                    Table T-01                                │
│                    Origin Food House                         │
│                    Scan to order                             │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Size: ○ Small  ● Medium  ○ Large                        ││
│  │ Format: ● PNG  ○ PDF                                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  [Download PNG]  [Download PDF]  [Print]        [Cancel]    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Dialog` (modal container)
- `RadioGroup` (size and format selection)
- `Button` (download, print, cancel)
- `Separator` (visual separation)

**New Components Needed**:
- `QRCodeDisplay` (canvas-based QR generation with customization)

**QR Code Content Format**:
```typescript
// URL encoded in QR code
const qrCodeUrl = `${process.env.NEXT_PUBLIC_CUSTOMER_APP_URL}/tables/${tableId}/join`;
// Example: http://localhost:3001/tables/clx123/join
```

#### Print Preview (Browser Native)

**Triggered by**: "Print" button in dialog or "Print All QR Codes"

**Print Layout** (CSS `@media print`):
```
┌────────────────────────────┬────────────────────────────┐
│                            │                            │
│   ┌──────────────────┐    │    ┌──────────────────┐   │
│   │                  │    │    │                  │   │
│   │    QR CODE       │    │    │    QR CODE       │   │
│   │                  │    │    │                  │   │
│   └──────────────────┘    │    └──────────────────┘   │
│                            │                            │
│   Table T-01               │    Table T-02              │
│   Origin Food House        │    Origin Food House       │
│   Scan to order            │    Scan to order           │
│                            │                            │
├────────────────────────────┼────────────────────────────┤
│                            │                            │
│   ┌──────────────────┐    │    ┌──────────────────┐   │
│   │    QR CODE       │    │    │    QR CODE       │   │
│   └──────────────────┘    │    └──────────────────┘   │
│   Table T-03               │    Table T-04              │
│                            │                            │
└────────────────────────────┴────────────────────────────┘

2 QR codes per row, cut lines, page breaks every 6 codes
```

**Print Styles**:
- Page size: A4
- Orientation: Portrait
- QR code size: 128x128mm (scannable from 1.5m distance)
- Font: 16px for table name, 12px for store name
- Include dashed cut lines
- No headers/footers

### 1.4 Technical Implementation

**QR Code Generation Library**: Use `qrcode.react` or `qrcode`

```typescript
// components/qr-code-display.tsx
import QRCode from 'qrcode.react';

interface QRCodeDisplayProps {
  tableId: string;
  tableName: string;
  storeName: string;
  size?: 'small' | 'medium' | 'large';
}

const sizeMap = {
  small: 128,
  medium: 256,
  large: 512
};

export function QRCodeDisplay({ tableId, tableName, storeName, size = 'medium' }: QRCodeDisplayProps) {
  const qrCodeUrl = `${process.env.NEXT_PUBLIC_CUSTOMER_APP_URL}/tables/${tableId}/join`;
  const pixelSize = sizeMap[size];

  return (
    <div className="flex flex-col items-center gap-4">
      <QRCode
        value={qrCodeUrl}
        size={pixelSize}
        level="M" // Error correction: L, M, Q, H
        includeMargin={true}
      />
      <div className="text-center">
        <div className="text-lg font-semibold">{tableName}</div>
        <div className="text-sm text-muted-foreground">{storeName}</div>
        <div className="text-xs text-muted-foreground">Scan to order</div>
      </div>
    </div>
  );
}
```

**Download Functionality**:

```typescript
// utils/qr-code-download.ts
export function downloadQRCodeAsPNG(tableId: string, tableName: string) {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  if (!canvas) return;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${tableName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

export async function downloadAllQRCodes(tables: Table[]) {
  // Generate ZIP file with JSZip library
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const table of tables) {
    // Generate QR code canvas for each table
    // Add to zip
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'table-qr-codes.zip';
  link.click();
}
```

### 1.5 Interaction Specifications

**Inline QR Preview (Table Row)**:
- Display: 32x32px QR code thumbnail
- Hover: Show tooltip with table name
- Click: Opens full QR dialog
- Touch target: 44x44px (includes padding)

**View QR Button**:
- Label: "View QR"
- Variant: `outline`
- Size: `sm`
- Icon: QR code icon
- Action: Opens `QRCodeDialog`

**Download Button**:
- Label: "Download"
- Variant: `ghost`
- Size: `sm`
- Icon: Download icon
- Action: Direct download PNG (256x256px)

**Print Button**:
- Label: "Print"
- Variant: `ghost`
- Size: `sm`
- Icon: Printer icon
- Action: Opens browser print dialog with print stylesheet

**Print All QR Codes Button**:
- Label: "Print All QR Codes"
- Variant: `default`
- Size: `default`
- Icon: Printer icon
- Action: Opens print preview with all tables in grid layout
- Confirmation: Show count (e.g., "Print 15 QR codes?")

**Download All Button**:
- Label: "Download All (ZIP)"
- Variant: `outline`
- Size: `default`
- Icon: Download icon
- Action: Generates ZIP file with all QR codes as PNG
- Loading state: Show spinner during ZIP generation

### 1.6 Error States

**No Tables**:
```
┌──────────────────────────────────────────────────┐
│  No tables created yet                           │
│                                                   │
│  [Empty state illustration]                      │
│                                                   │
│  Create your first table to generate QR codes    │
│                                                   │
│  [+ Create Table]                                │
└──────────────────────────────────────────────────┘
```

**QR Generation Failed**:
- Toast notification: "Failed to generate QR code. Please try again."
- Retry button in dialog
- Fallback: Show table URL as plain text

**Download Failed**:
- Toast notification: "Download failed. Please check your browser permissions."
- Retry button

**Print Failed**:
- Toast notification: "Print preview unavailable. Please enable pop-ups."
- Alternative: "Right-click QR code and select 'Print Image'"

### 1.7 Loading States

**Initial Page Load**:
- Show `Skeleton` components for table rows
- QR thumbnails: Show gray placeholder boxes

**QR Dialog Opening**:
- Fade-in animation (Dialog default)
- QR code: Show `Spinner` while generating canvas

**Bulk Download**:
- Show `Progress` bar: "Generating QR codes... 5/15"
- Disable UI during generation
- Success toast: "Downloaded 15 QR codes"

### 1.8 Accessibility

**Keyboard Navigation**:
- Tab order: Table rows → Action buttons → Bulk actions
- Enter/Space: Activate focused button
- Escape: Close QR dialog

**Screen Readers**:
- Table: Use semantic `<table>` with proper headers
- QR code: `alt="QR code for {tableName} - scan to order"`
- Buttons: Descriptive labels (not just icons)
- Dialog: `aria-labelledby` and `aria-describedby`

**Focus Management**:
- Opening dialog: Focus "Download PNG" button
- Closing dialog: Return focus to trigger button
- Print preview: Focus returns after print dialog closes

**ARIA Attributes**:
```tsx
<button
  aria-label={`View QR code for ${tableName}`}
  aria-describedby="qr-help-text"
>
  View QR
</button>

<span id="qr-help-text" className="sr-only">
  Opens dialog with printable QR code
</span>
```

### 1.9 Multi-Language Support

**Translatable Strings**:
- "QR Code"
- "View QR"
- "Download"
- "Download PNG"
- "Download PDF"
- "Print"
- "Print All QR Codes"
- "Download All (ZIP)"
- "Scan to order"
- "Size"
- "Format"
- "Small", "Medium", "Large"
- Error messages

**Text Expansion Considerations**:
- Button labels: Allow 150% expansion (Chinese/Thai)
- Dialog titles: Dynamic width
- QR code text: Single line, auto-scale font if needed

### 1.10 Responsive Design

**Desktop (1024px+)**:
- Table: Full width with all columns
- QR dialog: 600px max width, centered
- Bulk actions: Inline buttons

**Tablet (768px+)**:
- Table: Horizontal scroll if needed
- Actions column: Dropdown menu for space
- QR dialog: 500px max width

**Mobile (< 768px)**:
- Table: Card-based list view
- Each card: Table name, status, QR thumbnail, actions dropdown
- QR dialog: Full screen bottom sheet
- Bulk actions: Floating action button

### 1.11 Implementation Checklist

- [ ] Install `qrcode.react` library
- [ ] Create `QRCodeDisplay` component
- [ ] Create `QRCodeDialog` component
- [ ] Add QR column to tables list
- [ ] Implement download as PNG
- [ ] Implement download as PDF
- [ ] Implement browser print with custom stylesheet
- [ ] Create bulk print layout (2 columns, 6 per page)
- [ ] Implement ZIP download with `jszip`
- [ ] Add empty state for no tables
- [ ] Add error handling and retry logic
- [ ] Add loading states for all async operations
- [ ] Add keyboard navigation
- [ ] Add ARIA labels and roles
- [ ] Add translations for 4 languages
- [ ] Test print layout on different paper sizes
- [ ] Test QR code scanning from printed output (1.5m distance)
- [ ] Add analytics events (QR generated, downloaded, printed)

---

## 2. Manual Order Creation

**Location**: `/hub/sale` (existing page, major enhancement)
**Users**: Owner, Admin, Cashier, Server
**Priority**: HIGH (Core POS functionality)

### 2.1 User Goals

- Create orders for counter/takeout (no table)
- Create orders for phone orders
- Create orders for walk-in customers
- Select menu items with customizations
- Add customer information (optional)
- Process payment immediately or save for later
- Quick reorder from history

### 2.2 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Manual Order Creation Flow                  │
└─────────────────────────────────────────────────────────────┘

STAFF on Sale Page
    │
    ├─> Click "New Order" button
    │   │
    │   └─> Select Order Type:
    │       ├─> Counter/Dine-in
    │       ├─> Takeout
    │       └─> Phone Order
    │
    ├─> [Optional] Select Table (if dine-in)
    │   │
    │   └─> Or mark as "Counter"
    │
    ├─> [Optional] Add Customer Info:
    │   ├─> Name (text input)
    │   └─> Phone (tel input)
    │
    ├─> Add Items to Order:
    │   ├─> Browse categories (tabs)
    │   ├─> Search menu items
    │   ├─> Click item card
    │   │   │
    │   │   └─> Customization Dialog:
    │   │       ├─> Select options
    │   │       ├─> Add special instructions
    │   │       └─> Set quantity
    │   │
    │   └─> Item added to order summary (right panel)
    │
    ├─> Review Order Summary:
    │   ├─> Edit items (modify quantity, remove)
    │   ├─> View subtotal, VAT, service charge, total
    │   └─> Add order notes
    │
    └─> Complete Order:
        ├─> [Save for Later] → Creates PENDING order, no payment
        │
        └─> [Process Payment] → Opens Payment Dialog
            └─> (See Payment Recording section)
```

### 2.3 Component Specifications

#### Sale Page Layout

**Layout**: Split view (Browse Items | Order Summary)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Sale                                                   [New Order] [⋮]    │
├─────────────────────────────────────┬─────────────────────────────────────┤
│ Menu Items (60%)                    │ Order Summary (40%)                 │
├─────────────────────────────────────┼─────────────────────────────────────┤
│                                     │ Order #1234 - Counter               │
│ [Search items...]                   │ ─────────────────────────────────  │
│                                     │ Customer: John Doe (555-1234)       │
│ Categories:                         │ Type: Takeout                       │
│ [All] [Mains] [Sides] [Drinks]     │                                     │
│                                     │ Items:                              │
│ ┌──────────┐ ┌──────────┐          │ ├─ Burger x2          $18.00       │
│ │  Image   │ │  Image   │          │ │  └─ Extra cheese                 │
│ │          │ │          │          │ ├─ Fries x1           $4.50        │
│ │ Burger   │ │ Sandwich │          │ ├─ Coke x1            $2.50        │
│ │ $9.00    │ │ $12.00   │          │ └─ Water x1           $0.00        │
│ └──────────┘ └──────────┘          │                                     │
│                                     │ ─────────────────────────────────  │
│ ┌──────────┐ ┌──────────┐          │ Subtotal:            $25.00        │
│ │  Fries   │ │  Salad   │          │ VAT (7%):            $1.75         │
│ │ $4.50    │ │ $8.00    │          │ Service Charge (10%): $2.50        │
│ └──────────┘ └──────────┘          │ ─────────────────────────────────  │
│                                     │ Total:               $29.25        │
│                                     │                                     │
│                                     │ [Save for Later] [Process Payment] │
│                                     │                                     │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

**Components Used**:
- `Card` (order summary container)
- `Input` (search, customer info)
- `Tabs` (categories)
- `Button` (actions)
- `ScrollArea` (menu items, order items)
- `Badge` (order type)
- `Separator` (visual sections)

**New Components Needed**:
- `MenuItemCard` (grid item with image, name, price)
- `OrderItemRow` (editable cart item)
- `OrderSummary` (pricing breakdown)

#### New Order Dialog

**Trigger**: Click "New Order" button

```
┌──────────────────────────────────────────────────────────────┐
│  Create New Order                                   [✕] Close │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Order Type *                                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ○ Counter/Dine-in  ○ Takeout  ○ Phone Order          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Table (Optional)                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Select table ▼                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Customer Information (Optional)                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Name                                                  │  │
│  │ [                                                   ] │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Phone Number                                          │  │
│  │ [                                                   ] │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [Cancel]                               [Create Order]       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Dialog` (modal)
- `RadioGroup` (order type)
- `Select` (table selection)
- `Input` (customer info)
- `Form` (validation)
- `Button` (actions)

**Validation**:
- Order type: Required
- Table: Optional (disabled if Takeout or Phone Order)
- Customer info: Optional but recommended for Phone Orders

#### Item Customization Dialog

**Trigger**: Click menu item card

```
┌──────────────────────────────────────────────────────────────┐
│  Burger                                             [✕] Close │
├──────────────────────────────────────────────────────────────┤
│  [Image of burger]                                   $9.00    │
│                                                               │
│  Description: Juicy beef patty with fresh vegetables         │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Toppings (Select up to 3)                                   │
│  ☑ Lettuce          ☑ Tomato           ☐ Onions             │
│  ☐ Pickles          ☑ Extra Cheese +$1 ☐ Bacon +$2          │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Cooking Preference                                          │
│  ○ Rare  ● Medium  ○ Well Done                              │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Special Instructions                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [e.g., No mayo, extra sauce...]                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Quantity: [−] 1 [+]                             Total: $10.00│
│                                                               │
│  [Cancel]                                    [Add to Order]  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Dialog` (modal)
- `Checkbox` (multi-select customizations)
- `RadioGroup` (single-select customizations)
- `Textarea` (special instructions)
- `Button` (quantity, actions)

**Behavior**:
- Quantity buttons: +/- with keyboard input support
- Price updates live as customizations selected
- "Add to Order" button shows final price

### 2.4 Interaction Specifications

**New Order Button**:
- Position: Top right of Sale page
- Label: "+ New Order"
- Variant: `default`
- Keyboard: `Ctrl+N` or `Cmd+N`

**Category Tabs**:
- Display: Horizontal scrollable tabs
- Active indicator: Bottom border
- Keyboard: Arrow keys to navigate

**Menu Item Card**:
- Hover: Lift shadow effect
- Click: Opens customization dialog
- Double-click: Add with defaults (no customizations)
- Badge: "Out of Stock" (disabled state)

**Order Item Row**:
- Hover: Show edit/delete icons
- Click item name: Edit customizations
- Click quantity: Inline number input
- Click trash icon: Confirm deletion
- Drag handle: Reorder items (optional)

**Save for Later**:
- Variant: `outline`
- Confirms: "Order saved as PENDING. Continue?"
- Action: Creates order without payment, clears form

**Process Payment**:
- Variant: `default`
- Validates: At least 1 item in order
- Action: Opens Payment Dialog (see Payment section)

### 2.5 Error States

**Empty Order**:
- "Process Payment" button: Disabled with tooltip "Add items to order"
- Order summary: Show empty state "No items yet"

**Failed to Load Menu**:
```
┌──────────────────────────────────────────────────┐
│  [Empty state icon]                              │
│                                                   │
│  Failed to load menu items                       │
│  Please check your connection and try again      │
│                                                   │
│  [Retry]                                         │
└──────────────────────────────────────────────────┘
```

**Failed to Create Order**:
- Toast: "Failed to create order. Please try again."
- Keep order data in form (don't clear)
- Retry button

### 2.6 Loading States

**Menu Items Loading**:
- Show `Skeleton` cards in grid
- Count: 8 skeletons

**Creating Order**:
- Disable "Create Order" button
- Show `Spinner` on button
- Label: "Creating..."

**Adding Item**:
- "Add to Order" button: Show spinner
- Optimistic update: Add to summary immediately

### 2.7 Accessibility

**Keyboard Shortcuts**:
- `Ctrl+N`: New order
- `Ctrl+F`: Focus search
- `Tab`: Navigate menu items
- `Enter`: Select item
- `Escape`: Close dialogs
- `Ctrl+S`: Save for later
- `Ctrl+P`: Process payment

**Screen Reader Announcements**:
- "Item added to order: Burger, quantity 1, $10.00"
- "Order total updated: $29.25"
- "Order created successfully"

**Focus Management**:
- New order dialog: Focus order type radio
- Customization dialog: Focus first customization option
- After adding item: Focus returns to menu search

### 2.8 Multi-Language Considerations

**Translatable Strings**:
- All labels, buttons, placeholders
- Order type labels
- Customization group names
- Error messages

**Text Expansion**:
- Menu item cards: Allow name to wrap (2 lines max)
- Order summary: Dynamic column widths
- Buttons: Min-width to prevent squishing

### 2.9 Advanced Features (Optional)

**Quick Reorder**:
- Show recent orders in sidebar
- Click order → Duplicate items to new order
- Shortcut: `Ctrl+R`

**Order Templates**:
- Save frequently ordered combos
- E.g., "Lunch Special #1"
- Quick add button

**Split Screen Mode**:
- Multiple orders side-by-side
- For busy counters handling multiple customers

---

## 3. Payment Recording UI

**Location**: Payment Dialog (modal, triggered from Order Summary)
**Users**: Owner, Admin, Cashier, Server
**Priority**: HIGH (Core POS functionality)

### 3.1 User Goals

- Record payment for completed order
- Select payment method (Cash, Card, Mobile)
- Calculate change for cash payments
- Split payment across multiple methods
- Generate receipt
- Handle partial payments

### 3.2 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Payment Recording Flow                    │
└─────────────────────────────────────────────────────────────┘

STAFF clicks "Process Payment" on Order
    │
    └─> Payment Dialog Opens:
        │
        ├─> Review Order Summary:
        │   ├─> Items list
        │   ├─> Subtotal, VAT, service charge
        │   └─> Grand Total (bold, large)
        │
        ├─> Select Payment Method:
        │   ├─> Cash → Shows "Amount Tendered" input
        │   ├─> Card (Credit/Debit)
        │   ├─> Mobile Payment (QR Pay)
        │   └─> Other
        │
        ├─> [If Cash] Enter Amount Tendered:
        │   ├─> Numeric input
        │   ├─> Quick amount buttons ($20, $50, $100, Exact)
        │   └─> Live change calculation
        │
        ├─> [Optional] Split Payment:
        │   ├─> Click "+ Add Payment Method"
        │   ├─> Allocate amounts to each method
        │   └─> Show remaining balance
        │
        ├─> Add Payment Notes (Optional):
        │   └─> Text area for internal notes
        │
        └─> Complete Payment:
            ├─> Validate: Total tendered >= Grand total
            ├─> [Record Payment] → Processes payment
            │   │
            │   ├─> Success:
            │   │   ├─> Show success toast
            │   │   ├─> Print receipt (auto or prompt)
            │   │   └─> Close dialog
            │   │
            │   └─> Error:
            │       ├─> Show error message
            │       └─> Allow retry
            │
            └─> [Cancel] → Returns to order without saving
```

### 3.3 Component Specifications

#### Payment Dialog

```
┌──────────────────────────────────────────────────────────────┐
│  Record Payment - Order #1234                       [✕] Close │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Order Summary                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Burger x2              $18.00                         │  │
│  │ Fries x1               $4.50                          │  │
│  │ Coke x1                $2.50                          │  │
│  │                                                       │  │
│  │ Subtotal:              $25.00                         │  │
│  │ VAT (7%):              $1.75                          │  │
│  │ Service Charge (10%):  $2.50                          │  │
│  │ ────────────────────────────────────────────────────  │  │
│  │ Grand Total:           $29.25  (bold, text-2xl)      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Payment Method *                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [💵 Cash] [💳 Card] [📱 Mobile Pay] [Other]           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [If Cash Selected]                                          │
│  Amount Tendered *                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ $ [__________]                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│  Quick amounts: [$30] [$40] [$50] [Exact: $29.25]          │
│                                                               │
│  Change:                   $0.75  (text-xl, text-green)     │
│                                                               │
│  [+ Split Payment]  (Optional)                               │
│                                                               │
│  Payment Notes (Optional)                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [e.g., Card authorization code...]                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [Cancel]                  [Record Payment] (variant=default)│
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Dialog` (modal)
- `Card` (order summary)
- `ToggleGroup` or custom button group (payment methods)
- `Input` (amount tendered, type="number")
- `Button` (quick amounts, actions)
- `Textarea` (payment notes)
- `Separator`

**New Components Needed**:
- `PaymentMethodSelector` (custom toggle group with icons)
- `ChangeDisplay` (large, color-coded change amount)

#### Split Payment View

**Trigger**: Click "+ Split Payment"

```
┌──────────────────────────────────────────────────────────────┐
│  Record Payment - Order #1234 (Split)              [✕] Close │
├──────────────────────────────────────────────────────────────┤
│  Grand Total: $29.25                                         │
│  Remaining: $9.25  (updates live)                           │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Payment 1: Cash                               [🗑️ Remove]  │
│  Amount: $ [20.00_________]                                  │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Payment 2: Card                               [🗑️ Remove]  │
│  Amount: $ [9.25__________]                                  │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  [+ Add Another Payment Method]                              │
│                                                               │
│  ☑ Auto-allocate remaining to last method                    │
│                                                               │
│  [Cancel]                               [Record Payment]     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Card` (payment entry)
- `Select` (payment method per entry)
- `Input` (amount per method)
- `Checkbox` (auto-allocate)
- `Button` (add/remove, actions)

**Validation**:
- Total allocated = Grand total (exact match)
- Each amount > 0
- Remaining balance indicator (red if not zero, green if zero)

### 3.4 Interaction Specifications

**Payment Method Buttons**:
- Style: Toggle group, single select
- Icons: Cash (bill), Card (credit card), Mobile (phone), Other (ellipsis)
- Active state: Primary color background
- Click: Selects method, shows relevant inputs

**Amount Tendered Input**:
- Type: `number` with step 0.01
- Keyboard: Numeric keypad optimized
- Autofocus: When Cash selected
- Format: Currency with $ prefix
- Min value: Grand total (validation)

**Quick Amount Buttons**:
- Variant: `outline`
- Size: `sm`
- Values: Common denominations ($30, $40, $50) + "Exact" button
- Click: Fills amount tendered input
- "Exact": Sets to grand total (change = $0)

**Change Display**:
- Visibility: Only if Cash method and amount tendered > 0
- Formula: `amountTendered - grandTotal`
- Color:
  - Green (`text-green-600`): Change > 0
  - Red (`text-red-600`): Change < 0 (insufficient)
  - Muted: Change = 0
- Size: `text-xl font-bold`

**Record Payment Button**:
- Disabled if:
  - No payment method selected
  - Cash selected and amount tendered < grand total
  - Split payment and remaining balance != 0
- Loading state: Show spinner, disable button
- Success: Close dialog, show toast "Payment recorded"

### 3.5 Error States

**Insufficient Amount (Cash)**:
```
Change: -$5.00  (red, text-xl)
⚠️ Insufficient amount. Customer needs to pay $5.00 more.
```

**Split Payment Not Balanced**:
```
Remaining: $2.50  (red, text-xl)
⚠️ Payment split does not match total. Allocate remaining $2.50.
```

**Payment Processing Failed**:
- Toast: "Payment failed. Please try again or contact support."
- Keep dialog open with data intact
- Retry button

### 3.6 Loading States

**Recording Payment**:
- "Record Payment" button: Spinner + "Processing..."
- Disable all inputs
- Duration: 1-3 seconds

**Printing Receipt**:
- Show overlay: "Printing receipt..."
- Auto-dismiss on completion

### 3.7 Accessibility

**Keyboard Navigation**:
- Tab order: Payment methods → Amount input → Quick buttons → Notes → Action buttons
- Arrow keys: Navigate payment method toggle group
- Enter: Submit payment

**Screen Reader**:
- Announce payment method selection: "Cash selected"
- Announce change: "Change: $0.75"
- Announce errors: "Error: Insufficient amount"

**ARIA Labels**:
```tsx
<input
  type="number"
  aria-label="Amount tendered"
  aria-describedby="change-display"
  aria-invalid={change < 0}
/>

<div id="change-display" aria-live="polite">
  {change > 0 ? `Change: $${change.toFixed(2)}` : ''}
</div>
```

### 3.8 Multi-Language Considerations

**Translatable Strings**:
- Payment methods: "Cash", "Card", "Mobile Pay", "Other"
- "Amount Tendered", "Change", "Grand Total", "Remaining"
- "Quick amounts", "Exact"
- "Split Payment", "Add Another Payment Method"
- Error messages

**Currency Formatting**:
- Use `Intl.NumberFormat` for locale-aware currency display
- Symbol: $ (USD), ¥ (CNY), ฿ (THB), K (MMK)

### 3.9 Receipt Generation (Optional)

**After successful payment**:

```
┌──────────────────────────────────────────────────────────────┐
│  Payment Successful                                 [✕] Close │
├──────────────────────────────────────────────────────────────┤
│  [✓ Success icon]                                            │
│                                                               │
│  Payment of $29.25 recorded                                  │
│                                                               │
│  [Print Receipt]  [Email Receipt]  [Done]                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Print Receipt Action**:
- Opens browser print dialog
- Receipt format: 80mm thermal printer compatible
- Includes: Store info, order items, payment details, total, date/time
- QR code: Order ID for customer tracking (optional)

---

## 4. Bill Splitting

**Location**: Split Payment Dialog (modal, triggered from Order Summary)
**Users**: Owner, Admin, Cashier, Server
**Priority**: HIGH (Common restaurant use case)

### 4.1 User Goals

- Split bill evenly among N diners
- Split bill by specific items (each person pays for their items)
- Split bill by custom amounts
- Track what's been paid vs. unpaid
- Support multiple payment methods per split
- Handle tips and service charges correctly

### 4.2 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Bill Splitting Flow                      │
└─────────────────────────────────────────────────────────────┘

STAFF clicks "Split Bill" on Order Summary
    │
    └─> Split Bill Dialog Opens:
        │
        ├─> Review Full Order:
        │   ├─> All items with prices
        │   └─> Grand Total
        │
        ├─> Select Split Method:
        │   ├─> Even Split (N ways)
        │   ├─> By Item
        │   └─> Custom Amounts
        │
        ├─> [If Even Split]:
        │   ├─> Enter number of people
        │   ├─> Calculate amount per person
        │   └─> Show per-person total
        │
        ├─> [If By Item]:
        │   ├─> Assign each item to person(s)
        │   │   ├─> Person 1: Items A, B
        │   │   ├─> Person 2: Items C, D
        │   │   └─> Shared: Item E (split 50/50)
        │   └─> Calculate totals per person
        │
        ├─> [If Custom]:
        │   ├─> Enter custom amount per person
        │   └─> Show remaining balance
        │
        ├─> Handle Service Charges:
        │   ├─> ○ Split service charge evenly
        │   └─> ○ Apply to each person's subtotal
        │
        ├─> Handle Tips:
        │   ├─> Add tip per person (optional)
        │   └─> Or add total tip and split
        │
        └─> Record Payments:
            ├─> For each person:
            │   ├─> Show amount owed
            │   ├─> Select payment method
            │   ├─> Record payment
            │   └─> Mark as paid
            │
            └─> Complete when all paid:
                └─> Close order
```

### 4.3 Component Specifications

#### Split Bill Dialog - Method Selection

```
┌──────────────────────────────────────────────────────────────┐
│  Split Bill - Order #1234                           [✕] Close │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Order Total: $87.50                                         │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  How would you like to split this bill?                      │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  [👥 Even Split]                                     │  │
│  │  Divide the total evenly among diners                │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  [📋 By Item]                                        │  │
│  │  Each person pays for their own items                │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  [✏️ Custom Amounts]                                 │  │
│  │  Manually enter how much each person pays            │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [Cancel]                                                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Dialog` (modal)
- `Card` (method selection cards, clickable)
- `Button` (cancel)

#### Even Split View

```
┌──────────────────────────────────────────────────────────────┐
│  Split Bill Evenly - Order #1234           [← Back] [✕] Close│
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Order Total: $87.50                                         │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Number of People                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  [−] 2  [+]  (min: 2, max: 20)                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Split Breakdown:                                            │
│                                                               │
│  Subtotal per person:          $36.25                        │
│  VAT per person (7%):          $2.54                         │
│  Service Charge per person:    $5.00                         │
│  ────────────────────────────────────────────────────────   │
│  Each person pays:             $43.75  (text-2xl, bold)     │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Payment Status:                                             │
│  ├─ Person 1: $43.75   [✓ Paid] (Card)                      │
│  └─ Person 2: $43.75   [Record Payment] (Pending)           │
│                                                               │
│  [Record All Payments]                                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Dialog`
- `Button` (quantity controls, actions)
- `Card` (payment status per person)
- `Badge` ("Paid", "Pending")

#### By Item View

```
┌──────────────────────────────────────────────────────────────┐
│  Split Bill by Item - Order #1234          [← Back] [✕] Close│
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Assign items to each person                                 │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  [+ Add Person]  (Person 1, Person 2, Person 3)              │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Item              Price    Person 1  Person 2  Shared│    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ Burger            $9.00    ☑         ☐         ☐    │    │
│  │ Steak             $25.00   ☐         ☑         ☐    │    │
│  │ Fries (Large)     $6.00    ☐         ☐         ☑    │    │
│  │ Salad             $8.00    ☑         ☐         ☐    │    │
│  │ Coke x2           $5.00    ☑         ☑         ☐    │    │
│  │ Water x3          $0.00    ☑         ☑         ☑    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ☑ Split "Shared" items evenly among selected people         │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Split Breakdown:                                            │
│                                                               │
│  Person 1 Total: $20.67  (Burger, Salad, Coke, Water, Fries)│
│  Person 2 Total: $33.17  (Steak, Coke, Water, Fries)        │
│  Person 3 Total: $2.00   (Fries, Water)                     │
│  ────────────────────────────────────────────────────────   │
│  Total: $55.84  ⚠️ $31.66 unassigned                        │
│                                                               │
│  [Continue to Payment]  (disabled until total matches)       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Dialog`
- `Table` (item assignment grid)
- `Checkbox` (multi-select items per person)
- `Badge` (person labels)
- `Alert` (unassigned warning)
- `Button` (add person, continue)

**New Components Needed**:
- `ItemAssignmentTable` (custom table with checkbox columns)

#### Custom Amounts View

```
┌──────────────────────────────────────────────────────────────┐
│  Split Bill Custom - Order #1234           [← Back] [✕] Close│
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Order Total: $87.50                                         │
│  Remaining: $20.00  (red if > 0, green if = 0)              │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  [+ Add Person]                                              │
│                                                               │
│  Person 1                                        [🗑️ Remove] │
│  Amount: $ [30.00_________]                                  │
│  Payment Method: [Cash ▼]                                    │
│  Status: [✓ Paid]                                            │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Person 2                                        [🗑️ Remove] │
│  Amount: $ [37.50_________]                                  │
│  Payment Method: [Card ▼]                                    │
│  Status: [Record Payment]                                    │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Person 3                                        [🗑️ Remove] │
│  Amount: $ [20.00_________]                                  │
│  Payment Method: [Mobile Pay ▼]                              │
│  Status: [Pending]                                           │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  ☑ Auto-fill remaining amount for last person                │
│                                                               │
│  [Complete Split]  (enabled when remaining = 0)              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Dialog`
- `Card` (per-person payment entry)
- `Input` (amount, type="number")
- `Select` (payment method)
- `Button` (add/remove, record, complete)
- `Checkbox` (auto-fill option)

### 4.4 Interaction Specifications

**Method Selection Cards**:
- Hover: Subtle shadow lift
- Click: Opens respective split view
- Icons: Large, clear visual indicators

**Add Person Button**:
- Creates new person entry with default name "Person N"
- Allows renaming (click to edit inline)
- Min: 2 people, Max: 20 people

**Remove Person Button**:
- Shows confirmation: "Remove Person 2? Their items will be unassigned."
- Reallocates items if using "By Item" method

**Record Payment Button (per person)**:
- Opens mini payment dialog
- Shows only that person's amount
- Quick payment: Select method, confirm
- Updates status badge to "Paid"

**Complete Split Button**:
- Validates:
  - All amounts total to order total (within $0.01 tolerance)
  - All payments recorded or pending
- Creates multiple Payment records (one per person)
- Closes order and dialog

### 4.5 Error States

**Unbalanced Split**:
```
⚠️ Total assigned ($55.84) does not match order total ($87.50).
   $31.66 remaining. Please assign all items or adjust amounts.
```

**Overlapping Payments**:
```
⚠️ Total payments ($90.00) exceed order total ($87.50).
   Please reduce payment amounts by $2.50.
```

**No Items Assigned**:
```
⚠️ Person 2 has no items assigned. Remove this person or assign items.
```

### 4.6 Loading States

**Calculating Split**:
- Show spinner when recalculating totals (debounced)
- Lock inputs during calculation

**Recording Split Payments**:
- "Complete Split" button: Spinner + "Processing..."
- Disable all inputs

### 4.7 Accessibility

**Keyboard Navigation**:
- Tab: Navigate between person entries and inputs
- Arrow keys: Adjust number of people (quantity controls)
- Space: Toggle checkboxes (By Item view)
- Enter: Submit when on "Complete Split"

**Screen Reader**:
- Announce split method: "Even split selected"
- Announce calculations: "Each person pays $43.75"
- Announce status changes: "Person 1 payment recorded"
- Announce errors: "Warning: $20 remaining unassigned"

**Focus Management**:
- Method selection: Focus first card
- Adding person: Focus name input of new person
- Recording payment: Focus payment method selector

### 4.8 Multi-Language Considerations

**Translatable Strings**:
- Split methods: "Even Split", "By Item", "Custom Amounts"
- "Number of People", "Each person pays"
- "Assign items", "Shared", "Unassigned"
- "Remaining", "Total", "Status"
- All error messages

**Dynamic Text**:
- "Person 1", "Person 2" → Should support name customization
- Allow Unicode names (Chinese, Thai, Myanmar characters)

### 4.9 Complex Scenarios

**Shared Items (By Item Split)**:
- Mark item as "Shared"
- Divide price equally among people who selected it
- Example: Fries ($6) shared by 3 people = $2 each

**Partial Item Split**:
- Advanced: Split single item by percentage
- E.g., "Person 1: 70% of Steak, Person 2: 30%"
- UI: Slider per item (optional, v2 feature)

**Tip Handling**:
- Option 1: Each person adds their own tip
- Option 2: Total tip entered, split evenly or by subtotal ratio
- Default: Include in per-person total

**Service Charge Distribution**:
- Option 1: Split evenly (simple)
- Option 2: Proportional to each person's subtotal (fair)
- Setting: Store preference or per-order choice

---

## 5. Refund/Void UI

**Location**: Order Details View (modal or page)
**Users**: Owner, Admin, Cashier (with limits)
**Priority**: HIGH (Required for order corrections)

### 5.1 User Goals

- Cancel unpaid order (void)
- Refund paid order (full or partial)
- Provide reason for refund/void
- Require authorization for refunds
- Track refund audit trail

### 5.2 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Refund/Void Flow                          │
└─────────────────────────────────────────────────────────────┘

STAFF views Order Details
    │
    ├─> [If Order is PENDING/PREPARING/READY]:
    │   │
    │   └─> Click "Void Order" button:
    │       │
    │       └─> Void Order Dialog:
    │           ├─> Confirm: "Are you sure?"
    │           ├─> Select Reason: (dropdown)
    │           │   ├─ Customer cancelled
    │           │   ├─ Kitchen error
    │           │   ├─ Item unavailable
    │           │   ├─ Staff error
    │           │   └─ Other (text input)
    │           ├─> Add Notes (optional, textarea)
    │           └─> [Confirm Void] → Order status → CANCELLED
    │
    └─> [If Order is COMPLETED (paid)]:
        │
        └─> Click "Refund" button:
            │
            └─> Refund Dialog:
                ├─> View Order Summary:
                │   ├─> Paid amount: $87.50
                │   └─> Payment method: Card
                │
                ├─> Select Refund Type:
                │   ├─> ○ Full Refund
                │   └─> ○ Partial Refund
                │
                ├─> [If Partial] Enter Refund Amount:
                │   ├─> $ input (max: paid amount)
                │   └─> Select items to refund (optional)
                │
                ├─> Select Reason: (dropdown)
                │   ├─ Food quality issue
                │   ├─ Wrong order
                │   ├─ Customer complaint
                │   ├─ Overcharge
                │   └─ Other (text input)
                │
                ├─> Add Notes (required for partial refunds)
                │
                ├─> [If Store Setting] Require Manager Approval:
                │   ├─> Enter Manager PIN
                │   └─> Or Manager approves via notification
                │
                └─> [Process Refund]:
                    ├─> Success:
                    │   ├─> Create Refund record
                    │   ├─> Show success toast
                    │   ├─> Print refund receipt
                    │   └─> Update order status
                    │
                    └─> Error:
                        ├─> Show error message
                        └─> Allow retry
```

### 5.3 Component Specifications

#### Void Order Dialog

```
┌──────────────────────────────────────────────────────────────┐
│  Void Order #1234                                   [✕] Close │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ⚠️ Are you sure you want to void this order?                │
│                                                               │
│  This action cannot be undone. The order will be cancelled   │
│  and removed from the kitchen display.                       │
│                                                               │
│  Order Details:                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Table: T-05                                           │  │
│  │ Items: 4                                              │  │
│  │ Total: $45.50                                         │  │
│  │ Status: PREPARING                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Reason for Void *                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Select reason ▼                                       │  │
│  │ ├─ Customer cancelled                                 │  │
│  │ ├─ Kitchen error                                      │  │
│  │ ├─ Item unavailable (86'd)                            │  │
│  │ ├─ Staff input error                                  │  │
│  │ └─ Other                                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Additional Notes (Optional)                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [Explain why the order was voided...]                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [Cancel]                      [Void Order] (variant=destructive)│
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `AlertDialog` or `ConfirmationDialog`
- `Select` (reason dropdown)
- `Textarea` (notes)
- `Button` (actions)
- `Card` (order summary)
- `Alert` (warning banner)

#### Refund Dialog

```
┌──────────────────────────────────────────────────────────────┐
│  Refund Order #1234                                 [✕] Close │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Payment Information                                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Paid Amount:      $87.50                              │  │
│  │ Payment Method:   Credit Card                         │  │
│  │ Payment Date:     Jan 20, 2025 2:30 PM               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Refund Type *                                               │
│  ○ Full Refund ($87.50)                                      │
│  ● Partial Refund                                            │
│                                                               │
│  [If Partial Selected]                                       │
│  Refund Amount *                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ $ [25.00__________]  (max: $87.50)                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Items to Refund (Optional)                                  │
│  ☑ Steak             $25.00                                  │
│  ☐ Burger            $9.00                                   │
│  ☐ Fries             $4.50                                   │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Reason for Refund *                                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Select reason ▼                                       │  │
│  │ ├─ Food quality issue                                 │  │
│  │ ├─ Wrong order delivered                              │  │
│  │ ├─ Customer complaint                                 │  │
│  │ ├─ Pricing error / Overcharge                         │  │
│  │ ├─ Item not available                                 │  │
│  │ └─ Other                                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Additional Notes * (required for partial refunds)           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [Explain the refund reason in detail...]             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  [If Authorization Required]                                 │
│  Manager Approval                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Manager PIN: [****_____]                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [Cancel]              [Process Refund] (variant=destructive)│
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Dialog`
- `RadioGroup` (refund type)
- `Input` (refund amount, PIN)
- `Select` (reason)
- `Textarea` (notes)
- `Checkbox` (item selection)
- `Card` (payment info)
- `Button` (actions)

### 5.4 Interaction Specifications

**Void Order Button**:
- Location: Order details page/modal
- Label: "Void Order"
- Variant: `outline` or `ghost`
- Color: `destructive`
- Disabled if: Order status is COMPLETED or CANCELLED

**Refund Button**:
- Location: Order details page/modal
- Label: "Refund"
- Variant: `outline`
- Color: `destructive`
- Disabled if: Order status is not COMPLETED or already refunded

**Refund Type Radio**:
- Default: Full Refund
- Selecting Partial: Shows refund amount input and item selection

**Refund Amount Input**:
- Type: `number`, step 0.01
- Validation:
  - Min: $0.01
  - Max: Paid amount ($87.50)
  - Error: "Refund amount cannot exceed paid amount"

**Items to Refund Checkboxes**:
- Optional: Helps with record-keeping
- Automatically calculates total when items selected
- Updates refund amount input (or shows suggestion)

**Manager PIN Input**:
- Type: `password`, inputmode="numeric"
- Length: 4-6 digits
- Validation: Check against User.managerPin field
- Error: "Invalid PIN. Please try again."

**Process Refund Button**:
- Disabled until:
  - Reason selected
  - Notes provided (if partial refund)
  - Manager PIN entered (if required)
- Loading: Spinner + "Processing..."
- Success: Close dialog, show toast, optionally print receipt

### 5.5 Error States

**Cannot Void Paid Order**:
```
⚠️ This order has been paid and cannot be voided.
   Use the "Refund" option instead.
```

**Cannot Refund Unpaid Order**:
```
⚠️ This order has not been paid yet. Use "Void Order" to cancel it.
```

**Invalid Manager PIN**:
```
❌ Invalid manager PIN. Please try again.
   Attempts remaining: 2
   (lock after 3 failed attempts, require admin unlock)
```

**Refund Processing Failed**:
```
❌ Refund failed to process. Please check payment gateway status
   or contact support.
   [Retry]  [Contact Support]
```

### 5.6 Loading States

**Voiding Order**:
- "Void Order" button: Spinner + "Voiding..."
- Duration: 1-2 seconds
- Success: Close dialog, show toast "Order #1234 voided"

**Processing Refund**:
- "Process Refund" button: Spinner + "Processing refund..."
- Duration: 2-5 seconds (payment gateway communication)
- Progress: Show if > 3 seconds

### 5.7 Accessibility

**Keyboard Navigation**:
- Tab: Navigate all inputs and buttons
- Escape: Close dialog (with confirmation)
- Enter: Submit form

**Screen Reader**:
- Dialog title: "Void order 1234"
- Required fields: Announce "required"
- Errors: Announce immediately with `aria-live="assertive"`

**Focus Management**:
- Opening dialog: Focus reason dropdown
- After error: Focus invalid field
- After success: Return to order list

### 5.8 Multi-Language Considerations

**Translatable Strings**:
- Dialog titles
- Reason dropdown options
- Button labels
- Error messages
- Success messages
- Warning text

**Date/Time Formatting**:
- Use locale-aware formatting for payment date
- Example: "Jan 20, 2025 2:30 PM" (en) vs "2025年1月20日 14:30" (zh)

### 5.9 Authorization & Security

**Manager Approval Settings** (Store-level):
- Require for all refunds: Yes/No
- Require for refunds over $X: Yes/No, threshold amount
- Require for voids: Yes/No

**Audit Trail** (Backend):
- Log all voids and refunds with:
  - User ID (who performed action)
  - Manager ID (who approved, if applicable)
  - Timestamp
  - Reason code
  - Notes
  - Amount (for refunds)
- Queryable for reports and compliance

**Permission Levels**:
- OWNER/ADMIN: Can void and refund without approval
- CASHIER: Can void/refund with manager PIN
- SERVER/CHEF: Cannot void or refund (button hidden)

---

## 6. Reports Dashboard

**Location**: `/hub/(owner-admin)/reports` (new page)
**Users**: Owner, Admin
**Priority**: HIGH (Business insights)

### 6.1 User Goals

- View sales performance (daily, weekly, monthly)
- Identify top-selling menu items
- Analyze payment method breakdown
- Track order status distribution
- Monitor staff activity (future)
- Export reports as CSV
- Compare periods (this week vs last week)

### 6.2 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       Reports Dashboard Flow                 │
└─────────────────────────────────────────────────────────────┘

OWNER/ADMIN navigates to /hub/reports
    │
    ├─> Page loads with default view (Today)
    │
    ├─> Select Date Range:
    │   ├─> Preset: Today, This Week, This Month, Custom
    │   └─> Custom: Calendar picker (start date, end date)
    │
    ├─> View Key Metrics Cards:
    │   ├─> Total Sales (currency)
    │   ├─> Order Count (number)
    │   ├─> Average Order Value (currency)
    │   └─> Top Selling Item (name + count)
    │
    ├─> Browse Report Tabs:
    │   ├─> Sales Summary
    │   ├─> Popular Items
    │   ├─> Payment Breakdown
    │   ├─> Order Status
    │   └─> Staff Activity (future)
    │
    ├─> [Each Tab] View Visualizations:
    │   ├─> Charts (line, bar, pie)
    │   ├─> Data Tables (sortable, filterable)
    │   └─> Export button (CSV)
    │
    └─> [Optional] Compare Periods:
        ├─> Toggle "Compare with previous period"
        └─> Shows overlay/comparison in charts
```

### 6.3 Component Specifications

#### Reports Page Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Reports                                            [Store: Main Branch ▼] │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Date Range:  [Today ▼]  [This Week]  [This Month]  [Custom]             │
│               Jan 23, 2025                                                │
│                                                                            │
│  ┌────────────────┬────────────────┬────────────────┬─────────────────┐  │
│  │ Total Sales    │ Order Count    │ Avg Order Value│ Top Item        │  │
│  │ $2,450.50      │ 47             │ $52.14         │ Burger (12)     │  │
│  │ +12% vs yest   │ +5 vs yest     │ -$2.50 vs yest │                 │  │
│  └────────────────┴────────────────┴────────────────┴─────────────────┘  │
│                                                                            │
│  Tabs: [Sales Summary] [Popular Items] [Payments] [Order Status]         │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                                                                   │    │
│  │  Sales Summary                                 [Export CSV]      │    │
│  │  ────────────────────────────────────────────────────────────    │    │
│  │                                                                   │    │
│  │  [Line Chart: Sales over time]                                   │    │
│  │   (X-axis: Hours/Days, Y-axis: Revenue)                          │    │
│  │                                                                   │    │
│  │  ────────────────────────────────────────────────────────────    │    │
│  │                                                                   │    │
│  │  Hourly Breakdown (Table)                                        │    │
│  │  ┌────────┬────────────┬──────────┬──────────────┐              │    │
│  │  │ Hour   │ Sales      │ Orders   │ Avg Order    │              │    │
│  │  ├────────┼────────────┼──────────┼──────────────┤              │    │
│  │  │ 11 AM  │ $320.00    │ 8        │ $40.00       │              │    │
│  │  │ 12 PM  │ $580.50    │ 15       │ $38.70       │              │    │
│  │  │ 1 PM   │ $450.00    │ 10       │ $45.00       │              │    │
│  │  │ ...    │ ...        │ ...      │ ...          │              │    │
│  │  └────────┴────────────┴──────────┴──────────────┘              │    │
│  │                                                                   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Card` (page container, metric cards, tab content)
- `Tabs` (report types)
- `Select` (date range presets, store selector)
- `Calendar` (custom date range picker)
- `Button` (export CSV)
- `Table` (data tables)
- `Chart` (from @repo/ui, Recharts integration)
- `Badge` (comparison indicators)

**New Components Needed**:
- `MetricCard` (KPI display with trend)
- `DateRangeSelector` (preset + custom picker)
- `DataExporter` (CSV generation utility)

#### Key Metrics Cards

```
┌────────────────────────────────┐
│ Total Sales                    │
│                                │
│ $2,450.50                      │ <- text-3xl, font-bold
│ ↑ +12% vs yesterday  (green)   │ <- text-sm, with icon
│                                │
└────────────────────────────────┘
```

**Variants**:
- Positive trend: Green text, up arrow
- Negative trend: Red text, down arrow
- Neutral: Gray text, equals sign

#### Sales Summary Tab

**Chart**: Line chart showing sales over time
- X-axis: Time period (hours if Today, days if Week/Month)
- Y-axis: Revenue ($)
- Line: Blue gradient
- Tooltip: Hover shows exact value
- Responsive: Adjusts to container width

**Table**: Hourly/Daily breakdown
- Columns: Time Period, Sales, Order Count, Avg Order Value
- Sortable: Click column headers
- Pagination: 10 rows per page
- Total row: Footer with sum

#### Popular Items Tab

```
┌──────────────────────────────────────────────────────────────┐
│  Popular Items                               [Export CSV]    │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  [Bar Chart: Top 10 items by revenue]                        │
│   (X-axis: Item names, Y-axis: Revenue)                      │
│                                                               │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  Top Selling Items (Table)                                   │
│  ┌──────────────────┬──────────┬────────────┬────────────┐  │
│  │ Item             │ Qty Sold │ Revenue    │ % of Sales │  │
│  ├──────────────────┼──────────┼────────────┼────────────┤  │
│  │ Burger           │ 12       │ $108.00    │ 4.4%       │  │
│  │ Steak            │ 8        │ $200.00    │ 8.2%       │  │
│  │ Salad            │ 15       │ $120.00    │ 4.9%       │  │
│  │ ...              │ ...      │ ...        │ ...        │  │
│  └──────────────────┴──────────┴────────────┴────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Chart**: Horizontal bar chart
- Top 10 items by revenue
- Color: Gradient or category-coded
- Sortable: Toggle between revenue and quantity

#### Payment Breakdown Tab

```
┌──────────────────────────────────────────────────────────────┐
│  Payment Breakdown                           [Export CSV]    │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  [Pie Chart: Payment methods distribution]                   │
│   - Cash: 45% ($1,102.73)                                    │
│   - Card: 40% ($980.20)                                      │
│   - Mobile Pay: 15% ($367.57)                                │
│                                                               │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  Payment Methods (Table)                                     │
│  ┌──────────────────┬──────────┬────────────┬────────────┐  │
│  │ Method           │ Count    │ Total      │ % of Total │  │
│  ├──────────────────┼──────────┼────────────┼────────────┤  │
│  │ Cash             │ 21       │ $1,102.73  │ 45.0%      │  │
│  │ Credit Card      │ 15       │ $735.50    │ 30.0%      │  │
│  │ Debit Card       │ 6        │ $244.70    │ 10.0%      │  │
│  │ Mobile Payment   │ 5        │ $367.57    │ 15.0%      │  │
│  └──────────────────┴──────────┴────────────┴────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Chart**: Pie or donut chart
- Colors: Unique per payment method
- Interactive: Click segment to filter table

#### Order Status Tab

```
┌──────────────────────────────────────────────────────────────┐
│  Order Status                                [Export CSV]    │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  [Donut Chart: Order status distribution]                    │
│   - Completed: 42 (89%)                                      │
│   - Preparing: 3 (6%)                                        │
│   - Cancelled: 2 (4%)                                        │
│                                                               │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  Order Status Breakdown (Table)                              │
│  ┌──────────────────┬──────────┬────────────────────────┐   │
│  │ Status           │ Count    │ % of Total             │   │
│  ├──────────────────┼──────────┼────────────────────────┤   │
│  │ Completed        │ 42       │ 89.4%                  │   │
│  │ Preparing        │ 3        │ 6.4%                   │   │
│  │ Cancelled        │ 2        │ 4.3%                   │   │
│  └──────────────────┴──────────┴────────────────────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 6.4 Interaction Specifications

**Date Range Selector**:
- Presets: Buttons with active state
- Custom: Opens `Calendar` component in popover
- Behavior: Clicking preset immediately fetches data
- Keyboard: Arrow keys to navigate presets

**Store Selector** (for multi-store owners):
- Position: Top right
- Type: `Select` dropdown
- Options: All stores user has access to
- Behavior: Changing store refetches all reports

**Export CSV Button**:
- Position: Top right of each tab
- Label: "Export CSV"
- Icon: Download icon
- Action: Generates CSV, downloads immediately
- Filename: `sales-summary-2025-01-23.csv`

**Chart Interactions**:
- Hover: Show tooltip with exact values
- Click legend: Toggle series on/off
- Zoom: Click-drag on line charts (optional)
- Responsive: Scales down gracefully on mobile

**Table Interactions**:
- Sort: Click column header, toggle asc/desc
- Pagination: Bottom controls, show "1-10 of 47"
- Row click: Drill down to detail (future)

### 6.5 Error States

**No Data for Date Range**:
```
┌──────────────────────────────────────────────────┐
│  [Empty state illustration]                      │
│                                                   │
│  No sales data for Jan 23, 2025                  │
│  Try selecting a different date range            │
│                                                   │
│  [Change Date Range]                             │
└──────────────────────────────────────────────────┘
```

**Failed to Load Report**:
```
┌──────────────────────────────────────────────────┐
│  [Error icon]                                    │
│                                                   │
│  Failed to load report data                      │
│  Please check your connection and try again      │
│                                                   │
│  [Retry]                                         │
└──────────────────────────────────────────────────┘
```

**Export Failed**:
- Toast: "Failed to export CSV. Please try again."
- Retry automatically once, then show button

### 6.6 Loading States

**Initial Page Load**:
- Metric cards: Show `Skeleton` with shimmer
- Charts: Show gray placeholder rectangles
- Tables: Show skeleton rows

**Changing Date Range**:
- Disable date selector
- Show `Spinner` overlay on charts/tables
- Keep previous data visible (faded)

**Exporting CSV**:
- Button: Spinner icon + "Exporting..."
- Duration: 1-3 seconds

### 6.7 Accessibility

**Keyboard Navigation**:
- Tab: Navigate date presets, tabs, table rows
- Arrow keys: Navigate table cells
- Enter: Activate focused element
- `Ctrl+E`: Export CSV (focused tab)

**Screen Reader**:
- Charts: Provide text summary and data table alternative
- Metric cards: Announce value and trend
- Table: Use semantic `<table>` with proper headers

**Chart Accessibility**:
- `role="img"` on chart container
- `aria-label` describing chart content
- Hidden data table for screen readers

### 6.8 Multi-Language Considerations

**Translatable Strings**:
- Tab labels
- Metric card labels
- Table headers
- Date range presets
- Error messages

**Number Formatting**:
- Currency: Use locale-aware formatting
- Percentages: Use locale decimal separators
- Large numbers: Use thousand separators

**Date Formatting**:
- Adapt to locale: "Jan 23" (en) vs "1月23日" (zh)

### 6.9 Performance Considerations

**Data Fetching**:
- Cache report data for 5 minutes
- Use query parameters for date range
- Paginate table data (100 rows per page max)

**Chart Rendering**:
- Lazy load charts (only render visible tab)
- Limit data points: Max 100 points on line chart
- Use SVG for small datasets, Canvas for large

**CSV Export**:
- Generate server-side for large datasets
- Limit to current view data (don't export all time)

### 6.10 Implementation Checklist

- [ ] Create Reports page route (`/hub/(owner-admin)/reports`)
- [ ] Implement date range selector with presets + calendar
- [ ] Create metric card component with trend indicators
- [ ] Implement Sales Summary tab with line chart + table
- [ ] Implement Popular Items tab with bar chart + table
- [ ] Implement Payment Breakdown tab with pie chart + table
- [ ] Implement Order Status tab with donut chart + table
- [ ] Add CSV export functionality (client-side generation)
- [ ] Add empty states for no data
- [ ] Add error states and retry logic
- [ ] Add loading skeletons
- [ ] Make all charts responsive
- [ ] Add keyboard navigation
- [ ] Add ARIA labels for charts
- [ ] Add translations for 4 languages
- [ ] Implement caching strategy
- [ ] Add comparison mode (optional)
- [ ] Add store selector for multi-store owners
- [ ] Add analytics events (report viewed, exported)

---

## 7. Table State Dashboard

**Location**: `/hub/(owner-admin)/tables` (enhancement to existing page)
**Users**: Owner, Admin, Server
**Priority**: HIGH (Floor management)

### 7.1 User Goals

- Monitor all table states at a glance
- Quickly identify vacant vs. occupied tables
- See session details (time, guest count, order value)
- Transition tables between states
- Assign servers to tables
- Clear/reset tables after guests leave
- View floor map (visual layout)

### 7.2 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Table State Dashboard Flow                  │
└─────────────────────────────────────────────────────────────┘

STAFF navigates to /hub/tables
    │
    ├─> Page loads with default view (All Tables)
    │
    ├─> Select View Mode:
    │   ├─> List View (default)
    │   └─> Floor Map View (visual layout)
    │
    ├─> [List View] See all tables with status:
    │   ├─> Color-coded badges: Vacant, Seated, Ordering, etc.
    │   ├─> Session info: Time, guests, order value
    │   └─> Quick actions: View details, Close session
    │
    ├─> Filter by Status:
    │   ├─> All
    │   ├─> Vacant
    │   ├─> Occupied (any active state)
    │   ├─> Needs Clearing
    │   └─> Assigned to me (for servers)
    │
    ├─> Click Table Row/Card:
    │   │
    │   └─> Table Details Sheet:
    │       ├─> View session details
    │       ├─> View active orders
    │       ├─> View payments
    │       ├─> Assign server
    │       └─> Change state manually
    │
    ├─> [Floor Map View] See visual floor layout:
    │   ├─> Drag-and-drop table arrangement (future)
    │   ├─> Click table: Opens details sheet
    │   └─> Color-coded by status
    │
    └─> Auto-refresh:
        └─> Updates every 30 seconds (or via WebSocket)
```

### 7.3 Component Specifications

#### Table State Dashboard - List View

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Tables                          [List View] [Floor Map]    [+ Create Table]│
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Filter: [All] [Vacant] [Occupied] [Needs Clearing] [My Tables]          │
│                                                                            │
│  ⟳ Auto-refresh: ON  (last updated: 2:34 PM)                              │
│                                                                            │
│  ┌──────┬──────┬─────────┬──────────┬────────────────┬─────────────────┐ │
│  │ QR   │ Name │ Capacity│ Status   │ Session Info   │ Actions         │ │
│  ├──────┼──────┼─────────┼──────────┼────────────────┼─────────────────┤ │
│  │ [QR] │ T-01 │ 4 seats │ 🟢 Vacant│ -              │ [View] [Edit]   │ │
│  ├──────┼──────┼─────────┼──────────┼────────────────┼─────────────────┤ │
│  │ [QR] │ T-02 │ 6 seats │ 🔴 Seated│ 25 min, 4 ppl  │ [View] [Orders] │ │
│  │      │      │         │          │ Server: John   │ [Close Session] │ │
│  │      │      │         │          │ $45.50         │                 │ │
│  ├──────┼──────┼─────────┼──────────┼────────────────┼─────────────────┤ │
│  │ [QR] │ T-03 │ 2 seats │ 🟡 Order-│ 10 min, 2 ppl  │ [View] [Orders] │ │
│  │      │      │         │ ing      │ Server: Sarah  │ [Close Session] │ │
│  │      │      │         │          │ $22.00         │                 │ │
│  ├──────┼──────┼─────────┼──────────┼────────────────┼─────────────────┤ │
│  │ [QR] │ T-04 │ 8 seats │ 🟠 Ready │ 45 min, 6 ppl  │ [View] [Payment]│ │
│  │      │      │         │ to Pay   │ Server: Mike   │ [Close Session] │ │
│  │      │      │         │          │ $138.75        │                 │ │
│  ├──────┼──────┼─────────┼──────────┼────────────────┼─────────────────┤ │
│  │ [QR] │ T-05 │ 4 seats │ 🔵 Needs │ Session ended  │ [Clear Table]   │ │
│  │      │      │         │ Clearing │ 5 min ago      │                 │ │
│  └──────┴──────┴─────────┴──────────┴────────────────┴─────────────────┘ │
│                                                                            │
│  Pagination: [<] 1-10 of 25 [>]                                           │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Card` (page container)
- `Tabs` or `ToggleGroup` (view mode)
- `Button` (filters, actions)
- `Table` (list view)
- `Badge` (status indicators)
- `Pagination`
- `Switch` (auto-refresh toggle)

**Table State Colors**:
- 🟢 Vacant: Green (`bg-green-500`)
- 🔴 Seated: Red (`bg-red-500`)
- 🟡 Ordering: Yellow (`bg-yellow-500`)
- 🟠 Ready to Pay: Orange (`bg-orange-500`)
- 🔵 Needs Clearing: Blue (`bg-blue-500`)

#### Table Details Sheet

**Trigger**: Click table row or "View" button

```
┌──────────────────────────────────────────────────────────────┐
│  Table T-02                                         [✕] Close │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Status: 🔴 Seated                                           │
│  Capacity: 6 seats                                           │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Active Session                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Session ID: #abc123                                   │  │
│  │ Started: 2:09 PM (25 minutes ago)                     │  │
│  │ Guest Count: 4 people                                 │  │
│  │ Assigned Server: John Doe                             │  │
│  │                                         [Change Server]│  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Active Orders (2)                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Order #1234 - Preparing                               │  │
│  │ Items: Burger x2, Fries x1                            │  │
│  │ Total: $22.50                                         │  │
│  │                                           [View Order] │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Order #1235 - Pending                                 │  │
│  │ Items: Steak x1, Salad x1                             │  │
│  │ Total: $33.00                                         │  │
│  │                                           [View Order] │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Payments                                                    │
│  No payments recorded yet                                    │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│                                                               │
│  Session Total: $55.50                                       │
│                                                               │
│  [Mark Ready to Pay]  [Close Session]                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Sheet` (side panel)
- `Card` (section containers)
- `Badge` (status)
- `Button` (actions)
- `Select` (change server)
- `Separator`

#### Floor Map View (Future)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Tables - Floor Map                                    [+ Create Table]    │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [Legend] 🟢 Vacant  🔴 Seated  🟡 Ordering  🟠 Ready  🔵 Clearing        │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Main Dining Area                                                   │  │
│  │                                                                     │  │
│  │   ┌─────┐     ┌─────┐      ┌──────┐      ┌─────┐                 │  │
│  │   │ T-01│     │ T-02│      │ T-03 │      │ T-04│                 │  │
│  │   │ 🟢  │     │ 🔴  │      │ 🟡   │      │ 🟠  │                 │  │
│  │   │ 4   │     │ 6   │      │ 2    │      │ 8   │                 │  │
│  │   └─────┘     └─────┘      └──────┘      └─────┘                 │  │
│  │                                                                     │  │
│  │   ┌─────┐                   ┌──────┐                              │  │
│  │   │ T-05│                   │ T-06 │                              │  │
│  │   │ 🔵  │                   │ 🟢   │                              │  │
│  │   │ 4   │                   │ 4    │                              │  │
│  │   └─────┘                   └──────┘                              │  │
│  │                                                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Patio (Optional section)                                           │  │
│  │                                                                     │  │
│  │   ┌─────┐     ┌─────┐                                             │  │
│  │   │ P-01│     │ P-02│                                             │  │
│  │   │ 🟢  │     │ 🟢  │                                             │  │
│  │   │ 2   │     │ 2   │                                             │  │
│  │   └─────┘     └─────┘                                             │  │
│  │                                                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

**Components Used**:
- `Card` (floor sections)
- Custom `TableNode` component (draggable SVG/Canvas)
- `Tooltip` (hover for session info)

**Interaction**:
- Click table: Opens details sheet
- Drag table: Reposition (saves layout)
- Zoom: Pinch or scroll to zoom in/out

### 7.4 Interaction Specifications

**Status Filter Buttons**:
- Type: `ToggleGroup`, single select
- Default: "All"
- Active state: Primary color
- Count badge: Show number of tables per status

**Auto-refresh Toggle**:
- Type: `Switch`
- Default: ON
- Interval: 30 seconds
- Label: "Auto-refresh: ON/OFF"
- Manual refresh button: Circular arrow icon

**View Mode Toggle**:
- Type: `ToggleGroup`
- Options: "List View", "Floor Map"
- Default: "List View"
- Saves preference to localStorage

**Close Session Button**:
- Confirmation: "Close session for Table T-02? This will mark it as Needs Clearing."
- Action: Updates session status, triggers state change
- Success toast: "Session closed. Table T-02 needs clearing."

**Clear Table Button**:
- Only visible in "Needs Clearing" state
- Action: Resets table to "Vacant"
- Success toast: "Table T-02 cleared and ready."

**Change Server Select**:
- Shows all active servers
- Updates session, logs assignment
- Success toast: "Table assigned to Sarah"

### 7.5 Error States

**Failed to Load Tables**:
```
┌──────────────────────────────────────────────────┐
│  [Error icon]                                    │
│                                                   │
│  Failed to load table data                       │
│  Please check your connection and try again      │
│                                                   │
│  [Retry]                                         │
└──────────────────────────────────────────────────┘
```

**Failed to Update State**:
- Toast: "Failed to update table state. Please try again."
- Revert optimistic update

### 7.6 Loading States

**Initial Page Load**:
- Show `Skeleton` table rows
- Count: 10 skeletons

**Auto-refresh**:
- Subtle pulse on refresh icon
- No disruptive loader (use stale-while-revalidate)

**Updating State**:
- Show spinner on action button
- Optimistic UI update (revert on error)

### 7.7 Accessibility

**Keyboard Navigation**:
- Tab: Navigate table rows and action buttons
- Arrow keys: Navigate table rows
- Enter: Open details sheet
- `Ctrl+R`: Manual refresh

**Screen Reader**:
- Announce table status: "Table T-02, Seated, 4 guests, 25 minutes"
- Announce state changes: "Table T-02 closed, needs clearing"
- Auto-refresh: Announce "Table list updated" (polite)

**Focus Management**:
- Opening sheet: Focus first action button
- Closing sheet: Return to table row

### 7.8 Multi-Language Considerations

**Translatable Strings**:
- Table states
- Session info labels
- Action button labels
- Error messages
- Status filter labels

**Time Formatting**:
- Session duration: Locale-aware (e.g., "25 minutes", "25分钟")
- Timestamp: Locale-aware date/time format

### 7.9 Real-Time Updates (WebSocket)

**Implementation**:
- Subscribe to `table-state` events on page load
- Receive events: `table:updated`, `session:created`, `session:closed`
- Update UI in real-time without refresh
- Show toast for significant changes (optional)

**Fallback**:
- Polling every 30 seconds if WebSocket unavailable
- Show "Real-time updates unavailable" warning

### 7.10 Advanced Features (Future)

**Floor Map Customization**:
- Drag-and-drop table positioning
- Save layouts per floor/section
- Upload floor plan background image
- Add non-table elements (bar, kitchen, entrance)

**Server Assignment Rules**:
- Auto-assign new sessions to servers (round-robin)
- Workload balancing (tables per server)
- Section assignment (Server A handles Patio)

**Table Combining**:
- Select multiple tables
- Click "Combine Tables"
- Merge sessions and orders
- Show as single logical table

**Table Reservation**:
- Mark table as "Reserved" with time
- Show countdown: "Reserved for 15 minutes"
- Auto-release if no-show

---

## Accessibility Guidelines

### Universal Standards (All Features)

**WCAG 2.1 AA Compliance**:
- Color contrast: 4.5:1 for normal text, 3:1 for large text
- Touch targets: Minimum 44x44px
- Focus visible: Clear focus indicators (2px outline)
- Keyboard accessible: All functionality operable via keyboard
- Screen reader support: Semantic HTML and ARIA labels

### Keyboard Navigation Patterns

**Common Shortcuts**:
- `Tab` / `Shift+Tab`: Navigate interactive elements
- `Enter` / `Space`: Activate buttons, checkboxes
- `Escape`: Close dialogs, cancel operations
- `Arrow Keys`: Navigate lists, tables, radio groups
- `Ctrl+F`: Focus search input
- `Ctrl+S`: Save/Submit form
- `Ctrl+Z`: Undo (where applicable)

### ARIA Attributes

**Required for Custom Components**:
- `role`: Define component type (e.g., `role="dialog"`)
- `aria-label`: Provide accessible name
- `aria-labelledby`: Reference label element
- `aria-describedby`: Additional description
- `aria-expanded`: Collapsible state
- `aria-hidden`: Hide decorative elements
- `aria-live`: Announce dynamic changes
- `aria-invalid`: Form validation errors

### Screen Reader Considerations

**Announcements**:
- Use `aria-live="polite"` for non-critical updates
- Use `aria-live="assertive"` for errors
- Announce state changes: "Order #1234 paid"
- Provide text alternatives for charts and images

**Skip Links**:
- "Skip to main content" link at page top
- "Skip to navigation" for complex pages

### Focus Management

**Dialog/Modal Opening**:
1. Save current focus position
2. Move focus to first interactive element in dialog
3. Trap focus within dialog (no tabbing outside)
4. Return focus to trigger element on close

**Dynamic Content**:
- When new content loads, announce to screen reader
- Move focus to new content if appropriate
- Don't steal focus unexpectedly

---

## Multi-Language Considerations

### Supported Languages

1. **English (en)**: Default, left-to-right
2. **Chinese (zh)**: Simplified, 30-50% longer text
3. **Myanmar (my)**: Burmese script, unique typography
4. **Thai (th)**: Thai script, no word spacing

### Text Expansion

**Allow for growth**:
- English → Chinese: +30-50% length
- English → Myanmar: +20-40% length
- English → Thai: +10-30% length

**UI Accommodations**:
- Button labels: Use flexible widths, min-width
- Dialog titles: Allow wrapping (2 lines max)
- Table headers: Abbreviate or use icons + tooltips
- Form labels: Position above inputs (not inline)

### Font Considerations

**Typography**:
- English: Inter, system fonts
- Chinese: Noto Sans SC
- Myanmar: Noto Sans Myanmar
- Thai: Noto Sans Thai

**Line Height**:
- English: 1.5
- Chinese: 1.6 (taller characters)
- Myanmar: 1.7 (descenders)
- Thai: 1.6 (tone marks above)

### Number & Date Formatting

**Use `Intl` API**:
```typescript
// Currency
new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'USD'
}).format(29.25);
// → "$29.25" (en)
// → "¥29.25" (zh)

// Date
new Intl.DateTimeFormat(locale, {
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(new Date());
// → "Jan 23, 2025, 2:30 PM" (en)
// → "2025年1月23日 14:30" (zh)
```

### RTL Support (Future)

If adding Arabic or Hebrew:
- Use `dir="rtl"` attribute
- Flip layouts with CSS logical properties
- Mirror icons appropriately
- Test all components in RTL mode

---

## Summary & Recommendations

### Critical Blocker: QR Code Generation UI

**Priority**: CRITICAL (Blocks table ordering)
**Estimated Effort**: 2 developer days

**Key Design Decisions**:
1. **Inline QR Thumbnails**: Show small QR codes in table list for quick visual identification
2. **Print-Optimized Layout**: 2 QR codes per row, A4 format, scannable from 1.5m distance
3. **Bulk Operations**: "Print All" and "Download All (ZIP)" for efficiency
4. **Browser Print**: Use native print dialog with CSS `@media print` for compatibility
5. **Component Reuse**: Leverage `Dialog`, `Button`, `Table` from `@repo/ui`

**Implementation Checklist Highlights**:
- Use `qrcode.react` library for generation
- QR content: `{SOS_URL}/tables/{tableId}/join`
- Size options: Small (128px), Medium (256px), Large (512px)
- Download formats: PNG, PDF
- Print layout: 128mm QR codes, dashed cut lines

---

### Most Complex Feature: Bill Splitting

**Priority**: HIGH (Common restaurant use case)
**Estimated Effort**: 3-4 developer days (including backend refactoring)

**Key Design Decisions**:
1. **Three Split Methods**: Even, By Item, Custom Amounts (progressive disclosure)
2. **Visual Feedback**: Real-time calculation, color-coded remaining balance
3. **Shared Item Handling**: Allow items to be split across multiple people
4. **Payment Tracking**: Per-person payment status (Paid, Pending, Recording)
5. **Validation**: Ensure total assigned = order total before completion

**Complex Scenarios Addressed**:
- Shared items split evenly among selected people
- Service charge distribution (even vs. proportional)
- Tip handling (per-person or total split)
- Payment recording per person with different methods

**Backend Requirements**:
- Support multiple Payment records per Order
- Add `PaymentAllocation` model (optional) for item-level tracking
- Validate total payments = order grand total
- Audit logging for split transactions

---

### Other High-Priority Features

**Manual Order Creation** (3 days):
- Split-screen layout: Menu browser + Order summary
- Key innovation: Quick amount buttons for faster cash handling
- Reuse existing customization dialog pattern

**Payment Recording UI** (2 days):
- Critical: Change calculation for cash payments
- Key feature: Split payment support (multiple methods per order)
- Visual feedback: Large, color-coded change display

**Refund/Void UI** (2 days):
- Clear distinction: Void (unpaid) vs. Refund (paid)
- Security: Manager PIN requirement for refunds
- Audit trail: Reason codes and notes required

**Reports Dashboard** (3 days):
- Component reuse: Leverage `@repo/ui/components/chart.tsx` (Recharts)
- Key insight: Backend APIs exist, focus on visualization
- Export: Client-side CSV generation with FileSaver.js

**Table State Dashboard** (2 days):
- Real-time updates: WebSocket integration (30s polling fallback)
- Color-coded status: Clear visual hierarchy
- Future: Floor map view with drag-and-drop

---

### Design System Adherence

**Component Reuse Rate**: 95%+
- All features leverage existing `@repo/ui` components
- Only 5 new custom components needed:
  1. `QRCodeDisplay` (QR generation wrapper)
  2. `MenuItemCard` (product grid item)
  3. `OrderItemRow` (editable cart row)
  4. `PaymentMethodSelector` (toggle group with icons)
  5. `ItemAssignmentTable` (bill splitting grid)

**Consistency Patterns**:
- Dialogs: `Dialog` for modals, `Sheet` for side panels
- Forms: `react-hook-form` integration via `Form` component
- Buttons: Consistent variants (`default`, `outline`, `ghost`, `destructive`)
- Loading: `Spinner` for actions, `Skeleton` for content
- Errors: `Toast` for notifications, inline `Alert` for forms

---

### Next Steps for Implementation

**Phase 1 - Critical Blocker (Week 1)**:
1. QR Code Generation UI
   - Install `qrcode.react` library
   - Create QR display and dialog components
   - Implement print stylesheet
   - Add bulk download with `jszip`

**Phase 2 - High Priority (Weeks 2-3)**:
2. Manual Order Creation
3. Payment Recording UI
4. Table State Dashboard

**Phase 3 - Complex Features (Weeks 3-4)**:
5. Bill Splitting (requires backend work)
6. Refund/Void UI
7. Reports Dashboard

**Recommended Approach**:
- **Frontend-first**: Implement UI with mock data, then integrate backend
- **Iterative testing**: Test each feature with 4 languages immediately
- **Accessibility audit**: Run axe DevTools after each feature
- **Mobile fallback**: Test on tablets (RMS is desktop-first but should degrade gracefully)

---

**Document End**

This UX design specification provides implementation-ready guidance for all 7 missing features in Release Slice A. All designs follow established patterns, reuse existing components, and meet accessibility standards.
