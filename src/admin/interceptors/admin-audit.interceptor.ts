import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { AdminActionType } from "@prisma/client";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

import { AdminAuditService } from "../services/admin-audit.service";

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminAuditInterceptor.name);

  constructor(private adminAudit: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
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
                actionType: action as AdminActionType,
                targetType,
                targetId,
                details: JSON.stringify({
                  body: request.body,
                  query: request.query,
                }),
                ipAddress: request.ip,
                userAgent: request.headers["user-agent"],
              })
              .catch((error) => {
                this.logger.error("Failed to log admin action", error);
              });
          }
        },
      }),
    );
  }

  private getActionFromPath(path: string, method: string): string {
    if (path.includes("/suspend")) return "SUSPEND";
    if (path.includes("/ban")) return "BAN";
    if (path.includes("/reactivate")) return "REACTIVATE";
    if (path.includes("/verify")) return "VERIFY_PAYMENT";
    if (path.includes("/reject")) return "REJECT_PAYMENT";
    if (path.includes("/downgrade")) return "DOWNGRADE_TIER";
    if (path.includes("/password-reset")) return "FORCE_PASSWORD_RESET";

    if (method === "POST") return "CREATE";
    if (method === "PUT" || method === "PATCH") return "UPDATE";
    if (method === "DELETE") return "DELETE";

    return "UNKNOWN";
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
