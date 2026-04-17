import type { Context } from "elysia";
import {
  type DashboardAuthRuntime,
  isSharedAuthPrincipal,
} from "../auth/better-auth";

export const requireSessionGuard =
  (authRuntime: DashboardAuthRuntime | null) =>
  async ({
    log,
    request,
    status,
  }: {
    log?: {
      set(fields: Record<string, unknown>): void;
      warn(...args: unknown[]): void;
    };
    request: Request;
    status: Context["status"];
  }) => {
    log?.set({
      auth: {
        required: true,
      },
    });

    if (!authRuntime) {
      log?.warn("Auth runtime missing for protected route", {
        error: {
          code: "AUTH_RUNTIME_MISSING",
          fix: "Enable auth in createGoodchat({ auth: { enabled: true } }).",
          why: "Protected API route was registered without an auth runtime.",
        },
      });
      return status(401, { message: "Unauthorized" });
    }

    try {
      const session = await authRuntime.auth.api.getSession({
        headers: request.headers,
      });

      if (!session) {
        log?.warn("Auth session not found", {
          error: {
            code: "AUTH_SESSION_MISSING",
            fix: "Sign in and retry with the issued session cookie.",
            why: "No valid session was found in the request headers.",
          },
        });
        return status(401, { message: "Unauthorized" });
      }

      if (!isSharedAuthPrincipal(session)) {
        log?.warn("Auth principal rejected", {
          error: {
            code: "AUTH_PRINCIPAL_INVALID",
            fix: "Authenticate using the configured shared dashboard account.",
            why: "Session user is not the expected shared auth principal.",
          },
        });
        return status(401, { message: "Unauthorized" });
      }

      log?.set({
        auth: {
          result: "authorized",
        },
      });
    } catch {
      log?.warn("Auth session check failed", {
        error: {
          code: "AUTH_SESSION_CHECK_FAILED",
          fix: "Inspect auth storage and Better Auth runtime configuration.",
          why: "Session lookup threw while validating the request.",
        },
      });
      return status(401, { message: "Unauthorized" });
    }
  };
