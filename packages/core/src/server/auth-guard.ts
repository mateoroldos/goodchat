import type { Context } from "elysia";
import {
  type DashboardAuthRuntime,
  isSharedAuthPrincipal,
} from "../auth/better-auth";

export const requireSessionGuard =
  (authRuntime: DashboardAuthRuntime | null) =>
  async ({
    request,
    status,
  }: {
    request: Request;
    status: Context["status"];
  }) => {
    if (!authRuntime) {
      return status(401, { message: "Unauthorized" });
    }

    try {
      const session = await authRuntime.auth.api.getSession({
        headers: request.headers,
      });

      if (!session) {
        return status(401, { message: "Unauthorized" });
      }

      if (!isSharedAuthPrincipal(session)) {
        return status(401, { message: "Unauthorized" });
      }
    } catch {
      return status(401, { message: "Unauthorized" });
    }
  };
