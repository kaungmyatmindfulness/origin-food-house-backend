import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from './middleware/soft-delete.middleware';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    this.$use(softDeleteMiddleware());
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
