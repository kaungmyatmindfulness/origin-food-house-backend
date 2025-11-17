import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

import { SUPPORTED_LOCALES, SupportedLocale } from "../dto/translation.dto";

/**
 * Pipe to validate and parse locale parameter
 * Ensures locale is one of the supported locales (en, zh, my, th)
 */
@Injectable()
export class ParseLocalePipe implements PipeTransform<string, SupportedLocale> {
  transform(value: string): SupportedLocale {
    if (!SUPPORTED_LOCALES.includes(value as SupportedLocale)) {
      throw new BadRequestException(
        `Invalid locale '${value}'. Supported locales are: ${SUPPORTED_LOCALES.join(", ")}`,
      );
    }
    return value as SupportedLocale;
  }
}
