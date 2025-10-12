import { registerDecorator, ValidationOptions } from 'class-validator';

import { IsPositiveNumericStringConstraint } from '../validators/is-positive-numeric-string.validator';

/**
 * Decorator function that applies the IsPositiveNumericStringConstraint.
 * Checks if a string represents a numeric value >= 0.01.
 * @param validationOptions Standard class-validator options
 */
export function IsPositiveNumericString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPositiveNumericString',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveNumericStringConstraint,
    });
  };
}
