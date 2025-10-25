import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject } from 'class-validator';

export class CalculateSplitDto {
  @ApiProperty({
    description: 'Split type to calculate',
    enum: ['EVEN', 'BY_ITEM', 'CUSTOM'],
    example: 'EVEN',
  })
  @IsEnum(['EVEN', 'BY_ITEM', 'CUSTOM'])
  splitType: 'EVEN' | 'BY_ITEM' | 'CUSTOM';

  @ApiProperty({
    description: 'Split data based on split type',
    examples: {
      even: {
        summary: 'Even split among guests',
        value: { guestCount: 3 },
      },
      byItem: {
        summary: 'Split by item assignments',
        value: {
          itemAssignments: {
            guest1: ['item-id-1', 'item-id-2'],
            guest2: ['item-id-3'],
          },
        },
      },
      custom: {
        summary: 'Custom amounts per guest',
        value: {
          customAmounts: ['30.00', '45.00', '25.00'],
        },
      },
    },
  })
  @IsObject()
  splitData: Record<string, unknown>;
}
