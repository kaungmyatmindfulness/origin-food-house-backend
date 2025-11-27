import { applyDecorators, HttpStatus, Type } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ApiSuccessResponse } from "./api-success-response.decorator";

// =============================================================================
// ERROR RESPONSE DECORATORS
// =============================================================================

/**
 * Standard error responses for all authenticated endpoints
 * Includes: 400 Bad Request, 401 Unauthorized, 403 Forbidden
 */
export function ApiStandardErrors() {
  return applyDecorators(
    ApiBadRequestResponse({ description: "Invalid input data" }),
    ApiUnauthorizedResponse({ description: "Authentication required" }),
    ApiForbiddenResponse({ description: "Insufficient permissions" }),
  );
}

/**
 * Standard errors for endpoints that access a specific resource
 * Includes: 400, 401, 403, 404 Not Found
 */
export function ApiResourceErrors() {
  return applyDecorators(
    ApiStandardErrors(),
    ApiNotFoundResponse({ description: "Resource not found" }),
  );
}

/**
 * Standard errors for create operations
 * Includes: 400, 401, 403, 409 Conflict
 */
export function ApiCreateErrors() {
  return applyDecorators(
    ApiStandardErrors(),
    ApiConflictResponse({ description: "Resource already exists" }),
  );
}

/**
 * Standard errors for delete operations
 * Includes: 400, 401, 403, 404
 */
export function ApiDeleteErrors() {
  return applyDecorators(ApiResourceErrors());
}

// =============================================================================
// AUTHENTICATION DECORATORS
// =============================================================================

/**
 * Combines @ApiBearerAuth with standard auth error responses
 */
export function ApiAuth() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: "Authentication required" }),
  );
}

/**
 * Full authentication with role-based access control documentation
 */
export function ApiAuthWithRoles() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: "Authentication required" }),
    ApiForbiddenResponse({
      description: "Insufficient permissions for this operation",
    }),
  );
}

// =============================================================================
// PARAMETER DECORATORS
// =============================================================================

/**
 * Document a UUID path parameter
 */
export function ApiUuidParam(name: string, description: string) {
  return applyDecorators(
    ApiParam({
      name,
      description,
      type: String,
      format: "uuid",
    }),
  );
}

/**
 * Document a store ID path parameter
 */
export function ApiStoreIdParam(description = "ID (UUID) of the store") {
  return applyDecorators(ApiUuidParam("storeId", description));
}

/**
 * Document a resource ID path parameter
 */
export function ApiIdParam(description = "ID (UUID) of the resource") {
  return applyDecorators(ApiUuidParam("id", description));
}

// =============================================================================
// CRUD ENDPOINT DECORATORS
// =============================================================================

/**
 * Full documentation for GET (list) endpoint
 * @param model Response DTO class
 * @param resourceName Human-readable resource name (e.g., "menu items")
 * @param options Additional options
 */
export function ApiGetAll<T>(
  model: Type<T>,
  resourceName: string,
  options?: { summary?: string; description?: string },
) {
  const summary = options?.summary ?? `Get all ${resourceName}`;
  const description =
    options?.description ?? `${resourceName} retrieved successfully`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiSuccessResponse(model, { isArray: true, description }),
  );
}

/**
 * Full documentation for GET (single) endpoint - Public
 * @param model Response DTO class
 * @param resourceName Human-readable resource name (e.g., "menu item")
 * @param options Additional options
 */
export function ApiGetOne<T>(
  model: Type<T>,
  resourceName: string,
  options?: { summary?: string; description?: string; idDescription?: string },
) {
  const summary = options?.summary ?? `Get ${resourceName} by ID`;
  const description =
    options?.description ?? `${resourceName} retrieved successfully`;
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiNotFoundResponse({ description: `${resourceName} not found` }),
  );
}

/**
 * Full documentation for GET (single) endpoint - Authenticated
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiGetOneAuth<T>(
  model: Type<T>,
  resourceName: string,
  options?: { summary?: string; description?: string; idDescription?: string },
) {
  const summary = options?.summary ?? `Get ${resourceName} by ID`;
  const description =
    options?.description ?? `${resourceName} retrieved successfully`;
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuth(),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiResourceErrors(),
  );
}

/**
 * Full documentation for POST (create) endpoint
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiCreate<T>(
  model: Type<T>,
  resourceName: string,
  options?: { summary?: string; description?: string; roles?: string },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary = options?.summary ?? `Create ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} created successfully`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiSuccessResponse(model, { status: HttpStatus.CREATED, description }),
    ApiCreateErrors(),
  );
}

/**
 * Full documentation for PUT (full update) endpoint
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiUpdate<T>(
  model: Type<T>,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    idDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary = options?.summary ?? `Update ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} updated successfully`;
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiResourceErrors(),
  );
}

/**
 * Full documentation for PATCH (partial update) endpoint
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiPatch<T>(
  model: Type<T>,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    idDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary =
    options?.summary ?? `Partially update ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} updated successfully`;
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiResourceErrors(),
  );
}

/**
 * Full documentation for DELETE endpoint
 * @param model Response DTO class (usually a deleted response DTO)
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiDelete<T>(
  model: Type<T>,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    idDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary = options?.summary ?? `Delete ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} deleted successfully`;
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiDeleteErrors(),
  );
}

/**
 * Full documentation for DELETE endpoint with NO_CONTENT response
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiDeleteNoContent(
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    idDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary = options?.summary ?? `Delete ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} deleted successfully`;
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiIdParam(idDescription),
    ApiNoContentResponse({ description }),
    ApiDeleteErrors(),
  );
}

// =============================================================================
// NESTED RESOURCE DECORATORS (e.g., /stores/:storeId/menu-items)
// =============================================================================

/**
 * Full documentation for GET (list) endpoint under a store
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiStoreGetAll<T>(
  model: Type<T>,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    storeIdDescription?: string;
  },
) {
  const summary = options?.summary ?? `Get all ${resourceName} for a store`;
  const description =
    options?.description ?? `${resourceName} retrieved successfully`;
  const storeIdDescription =
    options?.storeIdDescription ?? "ID (UUID) of the store";

  return applyDecorators(
    ApiOperation({ summary }),
    ApiStoreIdParam(storeIdDescription),
    ApiSuccessResponse(model, { isArray: true, description }),
    ApiNotFoundResponse({ description: "Store not found" }),
  );
}

/**
 * Full documentation for GET (single) endpoint under a store - Public
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiStoreGetOne<T>(
  model: Type<T>,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    storeIdDescription?: string;
    idDescription?: string;
  },
) {
  const summary = options?.summary ?? `Get ${resourceName} by ID`;
  const description =
    options?.description ?? `${resourceName} retrieved successfully`;
  const storeIdDescription =
    options?.storeIdDescription ?? "ID (UUID) of the store";
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiStoreIdParam(storeIdDescription),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiNotFoundResponse({ description: `${resourceName} not found` }),
  );
}

/**
 * Full documentation for POST (create) endpoint under a store
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiStoreCreate<T>(
  model: Type<T>,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    storeIdDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary = options?.summary ?? `Create ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} created successfully`;
  const storeIdDescription =
    options?.storeIdDescription ?? "ID (UUID) of the store";

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiStoreIdParam(storeIdDescription),
    ApiSuccessResponse(model, { status: HttpStatus.CREATED, description }),
    ApiCreateErrors(),
    ApiNotFoundResponse({ description: "Store not found" }),
  );
}

/**
 * Full documentation for PUT (full update) endpoint under a store
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiStoreUpdate<T>(
  model: Type<T>,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    storeIdDescription?: string;
    idDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary = options?.summary ?? `Update ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} updated successfully`;
  const storeIdDescription =
    options?.storeIdDescription ?? "ID (UUID) of the store";
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiStoreIdParam(storeIdDescription),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiResourceErrors(),
  );
}

/**
 * Full documentation for PATCH (partial update) endpoint under a store
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiStorePatch<T>(
  model: Type<T>,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    storeIdDescription?: string;
    idDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary =
    options?.summary ?? `Partially update ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} updated successfully`;
  const storeIdDescription =
    options?.storeIdDescription ?? "ID (UUID) of the store";
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiStoreIdParam(storeIdDescription),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiResourceErrors(),
  );
}

/**
 * Full documentation for DELETE endpoint under a store
 * @param model Response DTO class
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiStoreDelete<T>(
  model: Type<T>,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    storeIdDescription?: string;
    idDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary = options?.summary ?? `Delete ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} deleted successfully`;
  const storeIdDescription =
    options?.storeIdDescription ?? "ID (UUID) of the store";
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiStoreIdParam(storeIdDescription),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiDeleteErrors(),
  );
}

/**
 * Full documentation for DELETE endpoint under a store with NO_CONTENT response
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiStoreDeleteNoContent(
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    storeIdDescription?: string;
    idDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary = options?.summary ?? `Delete ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} deleted successfully`;
  const storeIdDescription =
    options?.storeIdDescription ?? "ID (UUID) of the store";
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiStoreIdParam(storeIdDescription),
    ApiIdParam(idDescription),
    ApiNoContentResponse({ description }),
    ApiDeleteErrors(),
  );
}

// =============================================================================
// SPECIAL OPERATION DECORATORS
// =============================================================================

/**
 * Documentation for action endpoints (e.g., POST /orders/:id/cancel)
 * @param model Response DTO class
 * @param action Action name (e.g., "cancel", "approve", "reject")
 * @param resourceName Human-readable resource name
 * @param options Additional options
 */
export function ApiAction<T>(
  model: Type<T>,
  action: string,
  resourceName: string,
  options?: {
    summary?: string;
    description?: string;
    roles?: string;
    idDescription?: string;
  },
) {
  const roles = options?.roles ? ` (${options.roles})` : "";
  const summary =
    options?.summary ??
    `${action.charAt(0).toUpperCase() + action.slice(1)} ${resourceName}${roles}`;
  const description =
    options?.description ?? `${resourceName} ${action}ed successfully`;
  const idDescription =
    options?.idDescription ?? `ID (UUID) of the ${resourceName}`;

  return applyDecorators(
    ApiOperation({ summary }),
    ApiAuthWithRoles(),
    ApiIdParam(idDescription),
    ApiSuccessResponse(model, description),
    ApiResourceErrors(),
  );
}

/**
 * Documentation for public action endpoints (no auth required)
 * @param model Response DTO class
 * @param summary Operation summary
 * @param description Success description
 */
export function ApiPublicAction<T>(
  model: Type<T>,
  summary: string,
  description: string,
) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiSuccessResponse(model, description),
    ApiBadRequestResponse({ description: "Invalid input data" }),
  );
}
