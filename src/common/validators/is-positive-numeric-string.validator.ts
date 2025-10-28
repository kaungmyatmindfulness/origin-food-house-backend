import { Injectable } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";

@ValidatorConstraint({ name: "isPositiveNumericString", async: false })
@Injectable()
export class IsPositiveNumericStringConstraint
  implements ValidatorConstraintInterface
{
  private readonly minValue = new Decimal("0.01");

  validate(value: unknown, _args: ValidationArguments): boolean {
    if (typeof value !== "string") {
      return false;
    }

    try {
      const decimalValue = new Decimal(value);

      if (decimalValue.isNaN() || !decimalValue.isFinite()) {
        return false;
      }

      return decimalValue.greaterThanOrEqualTo(this.minValue);
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a numeric string representing a value of ${this.minValue.toString()} or greater`;
  }
}
