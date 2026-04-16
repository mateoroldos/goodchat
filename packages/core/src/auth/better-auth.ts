import type { AuthConfig } from "@goodchat/contracts/config/types";
import type { Database } from "@goodchat/contracts/database/interface";
import { betterAuth } from "better-auth";
import type { DB as BetterAuthDrizzleDatabase } from "better-auth/adapters/drizzle";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { openAPI } from "better-auth/plugins";

export const SHARED_AUTH_EMAIL = "owner@goodchat.internal";

export interface DashboardAuthRuntime {
  auth: ReturnType<typeof betterAuth>;
  closeBootstrapSignup: () => void;
}

const SIGN_UP_EMAIL_PATH = "/sign-up/email";
const SIGN_IN_EMAIL_PATH = "/sign-in/email";
const SIGN_UP_DISABLED_MESSAGE = "Sign up is disabled";
const INVALID_CREDENTIALS_MESSAGE = "Invalid credentials";

export const isSharedAuthPrincipal = (session: unknown): boolean => {
  if (!session || typeof session !== "object") {
    return false;
  }

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") {
    return false;
  }

  const email = (user as { email?: unknown }).email;
  return email === SHARED_AUTH_EMAIL;
};

const assertRequiredEnv = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`${name} is required when auth is enabled`);
  }
  return value;
};

const getEmailFromRequestBody = (body: unknown): string | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const email = (body as { email?: unknown }).email;
  return typeof email === "string" ? email : null;
};

const resolveAuthDatabase = (database: Database) => {
  const authCapability = database.auth;
  if (!authCapability) {
    throw new Error(
      `Database adapter for dialect "${database.dialect}" does not expose auth capability`
    );
  }

  return authCapability.getBetterAuthDatabaseConfig();
};

export const createAuthRuntime = (input: {
  config: AuthConfig;
  database: Database;
}): DashboardAuthRuntime | null => {
  if (!input.config.enabled) {
    return null;
  }

  if (!input.config.password) {
    throw new Error("Auth password is required when auth is enabled");
  }

  const secret = assertRequiredEnv(
    process.env.GOODCHAT_AUTH_SECRET,
    "GOODCHAT_AUTH_SECRET"
  );
  const authDatabase = resolveAuthDatabase(input.database);
  let isBootstrapSignupOpen = true;

  const auth = betterAuth({
    secret,
    basePath: "/api/auth",
    database: drizzleAdapter(authDatabase.db as BetterAuthDrizzleDatabase, {
      provider: authDatabase.provider,
      schema: authDatabase.schema,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      autoSignIn: false,
    },
    plugins: [openAPI()],
    hooks: {
      // We only allow one controlled sign-up to create the internal shared account.
      before: createAuthMiddleware((context) => {
        if (context.path !== SIGN_UP_EMAIL_PATH) {
          if (context.path !== SIGN_IN_EMAIL_PATH) {
            return Promise.resolve();
          }

          const email = getEmailFromRequestBody(context.body);
          if (email === SHARED_AUTH_EMAIL) {
            return Promise.resolve();
          }

          throw new APIError("BAD_REQUEST", {
            message: INVALID_CREDENTIALS_MESSAGE,
          });
        }

        const email = getEmailFromRequestBody(context.body);
        if (isBootstrapSignupOpen && email === SHARED_AUTH_EMAIL) {
          return Promise.resolve();
        }

        throw new APIError("BAD_REQUEST", {
          message: SIGN_UP_DISABLED_MESSAGE,
        });
      }),
    },
  });

  return {
    auth,
    closeBootstrapSignup: () => {
      isBootstrapSignupOpen = false;
    },
  };
};

interface BetterAuthOpenApiSchema {
  components?: Record<string, unknown>;
  paths: Record<string, Record<string, unknown>>;
}

export const getBetterAuthOpenApiDocumentation = async (
  auth: ReturnType<typeof betterAuth>,
  prefix = "/api/auth"
): Promise<BetterAuthOpenApiSchema> => {
  const generateOpenApiSchema = (
    auth.api as {
      generateOpenAPISchema?: () => Promise<BetterAuthOpenApiSchema>;
    }
  ).generateOpenAPISchema;

  if (!generateOpenApiSchema) {
    return { paths: {} };
  }

  const { components, paths } = await generateOpenApiSchema();
  const prefixedPaths: BetterAuthOpenApiSchema["paths"] = {};

  for (const [path, pathDefinition] of Object.entries(paths)) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const prefixedPath = normalizedPath.startsWith(prefix)
      ? normalizedPath
      : `${prefix}${normalizedPath}`;
    prefixedPaths[prefixedPath] = { ...pathDefinition };
  }

  return {
    components,
    paths: prefixedPaths,
  };
};
