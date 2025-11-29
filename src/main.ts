import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";

import { SessionCreatedResponseDto } from "src/active-table-session/dto/session-created-response.dto";
import { SessionResponseDto } from "src/active-table-session/dto/session-response.dto";
import {
  PaymentActionResponseDto as AdminPaymentActionResponseDto,
  PaymentDetailResponseDto as AdminPaymentDetailResponseDto,
  PaymentResponseDto as AdminPaymentResponseDto,
  PaymentStoreInfoDto,
} from "src/admin/dto/admin-payment-response.dto";
import { AdminPermissionsResponseDto } from "src/admin/dto/admin-permissions-response.dto";
import { AdminProfileResponseDto } from "src/admin/dto/admin-profile-response.dto";
import {
  AdminInfoDto,
  AdminStoreCountsDto,
  AdminStoreInformationDto,
  AdminStoreSubscriptionDto,
  AdminStoreTierDto,
  StoreActionResponseDto,
  StoreAnalyticsResponseDto,
  StoreDetailResponseDto,
  StoreResponseDto as AdminStoreResponseDto,
  SuspensionHistoryItemDto,
} from "src/admin/dto/admin-store-response.dto";
import {
  ActivityUserInfoDto,
  UserActionResponseDto,
  UserActivityResponseDto,
  UserAdminInfoDto,
  UserCountsDto,
  UserDetailResponseDto,
  UserResponseDto as AdminUserListResponseDto,
  UserStoreAssociationDto,
  UserStoreDetailsDto,
  UserStoreInfoDto,
  UserSuspensionHistoryItemDto,
} from "src/admin/dto/admin-user-response.dto";
import {
  AdminUserResponseDto,
  ValidateAdminResponseDto,
} from "src/admin/dto/validate-admin-response.dto";
import {
  CartItemCustomizationResponseDto,
  CartItemResponseDto,
  CartResponseDto,
} from "src/cart/dto/cart-response.dto";
import {
  PaginatedResponseDto,
  PaginationMeta,
} from "src/common/dto/paginated-response.dto";
import { StandardApiErrorDetails } from "src/common/dto/standard-api-error-details.dto";
import { StandardApiResponse } from "src/common/dto/standard-api-response.dto";
import { KitchenOrderResponseDto } from "src/kitchen/dto/kitchen-order-response.dto";
import {
  OrderItemCustomizationResponseDto,
  OrderItemResponseDto,
  OrderResponseDto,
} from "src/order/dto/order-response.dto";
import {
  PaymentResponseDto,
  RefundResponseDto,
} from "src/payment/dto/payment-response.dto";
import {
  OrderStatusCountDto,
  OrderStatusReportDto,
} from "src/report/dto/order-status-report.dto";
import {
  PaymentBreakdownDto,
  PaymentMethodBreakdownDto,
} from "src/report/dto/payment-breakdown.dto";
import {
  PopularItemDto,
  PopularItemsDto,
} from "src/report/dto/popular-items.dto";
import { SalesSummaryDto } from "src/report/dto/sales-summary.dto";
import { GetStoreDetailsResponseDto } from "src/store/dto/get-store-details-response.dto";
import { StoreInformationResponseDto } from "src/store/dto/store-information-response.dto";
import { StoreSettingResponseDto } from "src/store/dto/store-setting-response.dto";
import {
  OwnershipTransferResponseDto,
  PaymentRequestResponseDto,
  RefundRequestResponseDto,
  SubscriptionResponseDto,
  TrialEligibilityResponseDto,
  TrialInfoResponseDto,
} from "src/subscription/dto/subscription-response.dto";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get ConfigService from application context
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>("NODE_ENV", "production");
  const corsOrigin = configService.get<string>(
    "CORS_ORIGIN",
    "https://origin-food-house.com",
  );

  if (nodeEnv === "dev") {
    app.enableCors({
      origin: ["http://localhost:3001", "http://localhost:3002"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true,
    });
  } else {
    app.enableCors({
      origin: corsOrigin,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true,
    });
  }

  app.use(cookieParser());
  // app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Restaurant API")
    .setDescription(
      "API documentation for the Restaurant Management & Ordering system",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .setOpenAPIVersion("3.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      // Common
      StandardApiResponse,
      StandardApiErrorDetails,
      PaginatedResponseDto,
      PaginationMeta,
      // Session
      SessionCreatedResponseDto,
      SessionResponseDto,
      // Cart
      CartResponseDto,
      CartItemResponseDto,
      CartItemCustomizationResponseDto,
      // Order
      OrderResponseDto,
      OrderItemResponseDto,
      OrderItemCustomizationResponseDto,
      KitchenOrderResponseDto,
      // Payment (Order Payments)
      PaymentResponseDto,
      RefundResponseDto,
      // Admin Auth
      ValidateAdminResponseDto,
      AdminUserResponseDto,
      AdminProfileResponseDto,
      AdminPermissionsResponseDto,
      // Admin Store Management
      AdminStoreResponseDto,
      StoreDetailResponseDto,
      StoreActionResponseDto,
      StoreAnalyticsResponseDto,
      AdminStoreInformationDto,
      AdminStoreSubscriptionDto,
      AdminStoreTierDto,
      AdminStoreCountsDto,
      AdminInfoDto,
      SuspensionHistoryItemDto,
      // Admin User Management
      AdminUserListResponseDto,
      UserDetailResponseDto,
      UserActionResponseDto,
      UserActivityResponseDto,
      UserStoreInfoDto,
      UserStoreDetailsDto,
      UserStoreAssociationDto,
      UserCountsDto,
      UserAdminInfoDto,
      UserSuspensionHistoryItemDto,
      ActivityUserInfoDto,
      // Admin Payment Management
      AdminPaymentResponseDto,
      AdminPaymentDetailResponseDto,
      AdminPaymentActionResponseDto,
      PaymentStoreInfoDto,
      // Reports
      SalesSummaryDto,
      PaymentBreakdownDto,
      PaymentMethodBreakdownDto,
      PopularItemsDto,
      PopularItemDto,
      OrderStatusReportDto,
      OrderStatusCountDto,
      // Store
      GetStoreDetailsResponseDto,
      StoreInformationResponseDto,
      StoreSettingResponseDto,
      // Subscription
      SubscriptionResponseDto,
      TrialEligibilityResponseDto,
      TrialInfoResponseDto,
      PaymentRequestResponseDto,
      RefundRequestResponseDto,
      OwnershipTransferResponseDto,
    ],
  });
  SwaggerModule.setup("api-docs", app, document, {
    jsonDocumentUrl: "/api-docs-json",
  });

  await app.listen(3000);
}

void bootstrap();
