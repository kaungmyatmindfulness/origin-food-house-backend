import { applyDecorators, Type, HttpStatus } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { StandardApiResponse } from '../dto/standard-api-response.dto';

/**
 * Options for the ApiSuccessResponse decorator.
 */
interface ApiSuccessResponseOptions {
  description?: string;
  isArray?: boolean;
  status?: HttpStatus;
}

/**
 * A reusable decorator for documenting successful API responses (default 200 OK, or specified status)
 * wrapped in the standard StandardApiResponse structure.
 *
 * IMPORTANT: For this decorator to work correctly, ensure that StandardApiResponse
 * and the provided 'model' Type are registered using @ApiExtraModels()
 * on the controller OR globally in your Swagger setup (main.ts).
 *
 * @param model The DTO/class representing the structure of the 'data' payload.
 * @param options Optional configuration: description, whether data is an array, and status code.
 */
export function ApiSuccessResponse<T>(
  model: Type<T>,
  options?: ApiSuccessResponseOptions | string,
): MethodDecorator & ClassDecorator {
  const description =
    typeof options === 'string' ? options : options?.description;
  const isArray = typeof options === 'object' ? options.isArray : false;

  const status =
    (typeof options === 'object' ? options.status : undefined) ?? HttpStatus.OK;

  const dataSchema = isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  const ResponseDecorator =
    status === HttpStatus.CREATED ? ApiCreatedResponse : ApiOkResponse;

  return applyDecorators(
    ResponseDecorator({
      description: description ?? 'Operation successful.',
      schema: {
        allOf: [
          { $ref: getSchemaPath(StandardApiResponse) },
          {
            properties: {
              status: { type: 'string', example: 'success' },
              data: dataSchema,
              errors: { type: 'array', nullable: true, example: null },
              message: {
                type: 'string',
                example: description ?? 'Operation successful',
              },
            },
          },
        ],
      },
    }),
  );
}
