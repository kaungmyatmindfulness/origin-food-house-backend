import { Prisma } from '@prisma/client';
import { Logger } from '@nestjs/common';

const logger = new Logger('SoftDeleteMiddleware');

const SOFT_DELETE_MODELS = new Set<Prisma.ModelName>([
  Prisma.ModelName.MenuItem,
  Prisma.ModelName.Category,
]);

export function softDeleteMiddleware(): Prisma.Middleware {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
  ) => {
    if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
      return next(params);
    }

    if (params.action === 'delete') {
      logger.verbose(
        `[SoftDelete] Intercepted 'delete' -> 'update' for ${params.model}`,
      );

      params.action = 'update';

      const args = params.args as Prisma.MenuItemDeleteArgs;
      params.args = {
        where: args.where,
        data: { deletedAt: new Date() },
      } satisfies Prisma.MenuItemUpdateArgs;
    }

    if (params.action === 'deleteMany') {
      logger.verbose(
        `[SoftDelete] Intercepted 'deleteMany' -> 'updateMany' for MenuItem`,
      );

      params.action = 'updateMany';
      const args = params.args as Prisma.MenuItemDeleteManyArgs;
      params.args = {
        where: args?.where,
        data: { deletedAt: new Date() },
      } satisfies Prisma.MenuItemUpdateManyArgs;
    }

    return next(params);
  };
}
