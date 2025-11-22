import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

import { AdminActionType, AdminUser } from "src/generated/prisma/client";

import { AdminAuditService } from "../services/admin-audit.service";

interface AdminRequest {
  adminUser?: AdminUser;
  method: string;
  url: string;
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  ip: string;
  headers: {
    "user-agent"?: string;
    [key: string]: string | undefined;
  };
}

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminAuditInterceptor.name);

  constructor(private adminAudit: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const { adminUser } = request;
    const { method } = request;
    const path = request.url;

    if (method === "GET") {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          if (adminUser) {
            const action = this.getActionFromPath(path, method);
            const { targetType, targetId } = this.getTargetFromPath(
              path,
              request.params,
            );

            this.adminAudit
              .log({
                adminUserId: adminUser.id,
                actionType: action,
                targetType,
                targetId,
                details: JSON.stringify({
                  body: request.body,
                  query: request.query,
                }),
                ipAddress: request.ip,
                userAgent: request.headers["user-agent"] ?? "unknown",
              })
              .catch((error) => {
                this.logger.error("Failed to log admin action", error);
              });
          }
        },
      }),
    );
  }

  private getActionFromPath(path: string, _method: string): AdminActionType {
    if (path.includes("/stores") && path.includes("/suspend")) {
      return AdminActionType.STORE_SUSPENDED;
    }
    if (path.includes("/stores") && path.includes("/ban")) {
      return AdminActionType.STORE_BANNED;
    }
    if (path.includes("/stores") && path.includes("/reactivate")) {
      return AdminActionType.STORE_REACTIVATED;
    }
    if (path.includes("/users") && path.includes("/suspend")) {
      return AdminActionType.USER_SUSPENDED;
    }
    if (path.includes("/users") && path.includes("/ban")) {
      return AdminActionType.USER_BANNED;
    }
    if (path.includes("/users") && path.includes("/reactivate")) {
      return AdminActionType.USER_REACTIVATED;
    }
    if (path.includes("/verify")) {
      return AdminActionType.PAYMENT_VERIFIED;
    }
    if (path.includes("/reject")) {
      return AdminActionType.PAYMENT_REJECTED;
    }

    return AdminActionType.STORE_SETTINGS_OVERRIDDEN;
  }

  private getTargetFromPath(
    path: string,
    params: Record<string, string>,
  ): { targetType: string; targetId: string | null } {
    if (path.includes("/stores")) {
      return { targetType: "STORE", targetId: params.id ?? null };
    }
    if (path.includes("/users")) {
      return { targetType: "USER", targetId: params.id ?? null };
    }
    if (path.includes("/payments")) {
      return { targetType: "PAYMENT", targetId: params.id ?? null };
    }
    if (path.includes("/subscriptions")) {
      return { targetType: "SUBSCRIPTION", targetId: params.id ?? null };
    }

    return { targetType: "UNKNOWN", targetId: null };
  }
}
