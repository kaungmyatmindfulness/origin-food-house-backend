import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isOnlyOneIdentifierPresent', async: false })
export class IsOnlyOneIdentifierPresentConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments) {
    const object = args.object as GetCategoriesQueryDto;
    const idProvided =
      object.storeId !== undefined &&
      object.storeId !== null &&
      object.storeId !== '';
    const slugProvided =
      object.storeSlug !== undefined &&
      object.storeSlug !== null &&
      object.storeSlug !== '';

    return idProvided !== slugProvided;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Please provide either storeId OR storeSlug, but not both.';
  }
}

export class GetCategoriesQueryDto {
  @ApiPropertyOptional({
    description: 'ID (UUID) of the store (use this OR storeSlug).',
    format: 'uuid',
    example: '018ebc9a-7e1c-7f5e-b48a-3f4f72c55a1e',
  })
  @IsOptional()
  @IsUUID('all', { message: 'storeId must be a valid UUID string' })
  @Validate(IsOnlyOneIdentifierPresentConstraint)
  storeId?: string;

  @ApiPropertyOptional({
    description: 'URL Slug of the store (use this OR storeId).',
    example: 'demo-cafe',
  })
  @IsOptional()
  @IsString({ message: 'storeSlug must be a string' })
  @Validate(IsOnlyOneIdentifierPresentConstraint)
  storeSlug?: string;
}
