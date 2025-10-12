import { registerDecorator, ValidationOptions } from 'class-validator';

import { IsNonNegativeNumericStringConstraint } from 'src/common/validators/is-non-negative-numeric-string.validator';

/**
 * Custom Decorator Function: @IsNonNegativeNumericString()
 * Validates that the property is a string representing a number >= 0.
 *
 * @param validationOptions Standard class-validator options.
 */
export function IsNonNegativeNumericString(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNonNegativeNumericString',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNonNegativeNumericStringConstraint,
    });
  };
}
