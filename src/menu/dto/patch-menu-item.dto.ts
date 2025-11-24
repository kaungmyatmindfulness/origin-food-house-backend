import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

/**
 * DTO for partially updating a menu item.
 * Used for quick status changes by OWNER, ADMIN, or CHEF.
 */
export class PatchMenuItemDto {
  @ApiPropertyOptional({
    description: "Set out-of-stock status",
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  isOutOfStock?: boolean;

  @ApiPropertyOptional({
    description: "Set hidden status",
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}
