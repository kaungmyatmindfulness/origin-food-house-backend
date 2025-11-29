import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * DTO for audit log details.
 * Contains common fields that may appear in audit log details based on the action type.
 * Not all fields are present for every action - only relevant fields are populated.
 */
export class AuditLogDetailsDto {
  // Value change tracking
  @ApiPropertyOptional({
    description: "Previous value before the change",
    example: "10.00",
  })
  previousValue?: string;

  @ApiPropertyOptional({
    description: "New value after the change",
    example: "12.00",
  })
  newValue?: string;

  // Field-level changes
  @ApiPropertyOptional({
    description: "Name of the field that was changed",
    example: "price",
  })
  fieldName?: string;

  @ApiPropertyOptional({
    description: "Type of the entity that was changed",
    example: "MenuItem",
  })
  entityType?: string;

  @ApiPropertyOptional({
    description: "Name or identifier of the changed entity",
    example: "Margherita Pizza",
  })
  entityName?: string;

  // User-related actions
  @ApiPropertyOptional({
    description: "Previous role (for role change actions)",
    example: "CASHIER",
  })
  previousRole?: string;

  @ApiPropertyOptional({
    description: "New role (for role change actions)",
    example: "ADMIN",
  })
  newRole?: string;

  @ApiPropertyOptional({
    description: "Email of the user affected by the action",
    example: "user@example.com",
  })
  userEmail?: string;

  // Order-related actions
  @ApiPropertyOptional({
    description: "Order number for order-related actions",
    example: "ORD-001-123",
  })
  orderNumber?: string;

  @ApiPropertyOptional({
    description: "Previous order status",
    example: "PENDING",
  })
  previousStatus?: string;

  @ApiPropertyOptional({
    description: "New order status",
    example: "CONFIRMED",
  })
  newStatus?: string;

  // Payment-related actions
  @ApiPropertyOptional({
    description: "Payment amount",
    example: "50.00",
  })
  amount?: string;

  @ApiPropertyOptional({
    description: "Payment method used",
    example: "CASH",
  })
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: "Reason for refund or cancellation",
    example: "Customer request",
  })
  reason?: string;

  // Menu-related actions
  @ApiPropertyOptional({
    description: "Category name for menu item actions",
    example: "Appetizers",
  })
  categoryName?: string;

  @ApiPropertyOptional({
    description: "Price change amount",
    example: "2.00",
  })
  priceChange?: string;

  // Settings changes
  @ApiPropertyOptional({
    description: "Setting name that was changed",
    example: "vatRate",
  })
  settingName?: string;

  // Generic metadata
  @ApiPropertyOptional({
    description: "Number of items affected",
    example: 5,
  })
  itemCount?: number;

  @ApiPropertyOptional({
    description: "Additional context or notes",
    example: "Bulk update from admin panel",
  })
  notes?: string;
}
