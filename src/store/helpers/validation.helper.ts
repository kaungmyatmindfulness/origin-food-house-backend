import { BadRequestException } from "@nestjs/common";

import { BusinessHoursDto } from "src/store/dto/business-hours.dto";

/**
 * Pure validation utility functions for store service
 * These functions throw typed exceptions on validation failure
 */

/**
 * Validates business hours structure and time format.
 * Ensures all days are present with valid time ranges or closed status.
 * @param hours Business hours object with days of the week
 * @throws {BadRequestException} If any day is missing or has invalid time format
 */
export function validateBusinessHours(hours: BusinessHoursDto): void {
  const days: Array<keyof BusinessHoursDto> = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  for (const day of days) {
    if (!hours[day]) {
      throw new BadRequestException(`Missing business hours for ${day}`);
    }
    const dayHours = hours[day];
    if (dayHours.closed) continue;

    if (!dayHours.open || !dayHours.close) {
      throw new BadRequestException(`Invalid hours for ${day}`);
    }

    // Validate time format HH:MM
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(dayHours.open) || !timeRegex.test(dayHours.close)) {
      throw new BadRequestException(`Invalid time format for ${day}`);
    }
  }
}
