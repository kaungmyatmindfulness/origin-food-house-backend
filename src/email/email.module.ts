import { Module } from "@nestjs/common";

import { EmailService } from "./email.service";
import { SubscriptionEmailService } from "./subscription-email.service";

@Module({
  imports: [],
  providers: [EmailService, SubscriptionEmailService],
  exports: [EmailService, SubscriptionEmailService],
})
export class EmailModule {}
