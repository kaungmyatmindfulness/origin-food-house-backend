import { Module, forwardRef } from "@nestjs/common";

import { AuthModule } from "src/auth/auth.module";
import { CartModule } from "src/cart/cart.module";
import { OrderModule } from "src/order/order.module";
import { PrismaService } from "src/prisma/prisma.service";

import { ActiveTableSessionController } from "./active-table-session.controller";
import { ActiveTableSessionService } from "./active-table-session.service";

@Module({
  imports: [AuthModule, CartModule, forwardRef(() => OrderModule)],
  controllers: [ActiveTableSessionController],
  providers: [ActiveTableSessionService, PrismaService],
  exports: [ActiveTableSessionService],
})
export class ActiveTableSessionModule {}
