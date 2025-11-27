import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({
    summary: "Health check endpoint",
    description: "Returns the health status of the API service",
  })
  @ApiOkResponse({
    description: "Service is healthy",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        timestamp: { type: "string", example: "2025-11-27T10:30:00.000Z" },
      },
    },
  })
  healthCheck() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
