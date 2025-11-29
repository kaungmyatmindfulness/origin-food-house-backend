import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsObject, ValidateNested } from "class-validator";

import {
  EvenSplitDataDto,
  ByItemSplitDataDto,
  CustomSplitDataDto,
} from "./split-types.dto";

/**
 * Union type for split data based on split type.
 * Frontend should send the appropriate structure based on splitType.
 */
export type SplitDataUnion =
  | EvenSplitDataDto
  | ByItemSplitDataDto
  | CustomSplitDataDto;

export class CalculateSplitDto {
  @ApiProperty({
    description: "Split type to calculate",
    enum: ["EVEN", "BY_ITEM", "CUSTOM"],
    example: "EVEN",
  })
  @IsEnum(["EVEN", "BY_ITEM", "CUSTOM"])
  splitType: "EVEN" | "BY_ITEM" | "CUSTOM";

  @ApiProperty({
    description:
      "Split data based on split type. Structure varies by splitType: EVEN requires guestCount, BY_ITEM requires itemAssignments, CUSTOM requires customAmounts.",
    oneOf: [
      { $ref: "#/components/schemas/EvenSplitDataDto" },
      { $ref: "#/components/schemas/ByItemSplitDataDto" },
      { $ref: "#/components/schemas/CustomSplitDataDto" },
    ],
    examples: {
      even: {
        summary: "Even split among guests",
        value: { guestCount: 3 },
      },
      byItem: {
        summary: "Split by item assignments",
        value: {
          itemAssignments: {
            guest1: ["item-id-1", "item-id-2"],
            guest2: ["item-id-3"],
          },
        },
      },
      custom: {
        summary: "Custom amounts per guest",
        value: {
          customAmounts: ["30.00", "45.00", "25.00"],
        },
      },
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  splitData: SplitDataUnion;
}
