import { Prisma } from '@prisma/client';
import { Logger } from '@nestjs/common';

const logger = new Logger('SoftDeleteMiddleware');

export function softDeleteMiddleware(): Prisma.Middleware {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
  ) => {
    if (params.model !== 'MenuItem') {
      return next(params);
    }

    if (params.action === 'delete') {
      logger.verbose(
        `[SoftDelete] Intercepted 'delete' -> 'update' for MenuItem`,
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
