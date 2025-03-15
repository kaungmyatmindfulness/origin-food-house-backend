import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { BaseApiResponse } from '../dto/base-api-response.dto';

export function ApiSuccessResponse(model: Type<any>, description?: string) {
  return applyDecorators(
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseApiResponse) },
          {
            properties: {
              data: {
                $ref: getSchemaPath(model),
              },
            },
          },
        ],
      },
    }),
  );
}
