import type { DashboardAuthRuntime } from "./better-auth";
import { SHARED_AUTH_EMAIL } from "./better-auth";

const SHARED_ACCOUNT_NAME = "Project Owner";

export const bootstrapSharedAccount = async (input: {
  authRuntime: DashboardAuthRuntime;
  password: string;
}): Promise<void> => {
  const signUpResponse = await input.authRuntime.auth.api.signUpEmail({
    body: {
      email: SHARED_AUTH_EMAIL,
      password: input.password,
      name: SHARED_ACCOUNT_NAME,
    },
    asResponse: true,
  });

  if (signUpResponse.ok) {
    // Close the one-time bootstrap sign-up window after the shared account exists.
    input.authRuntime.closeBootstrapSignup();
    return;
  }

  const signInResponse = await input.authRuntime.auth.api.signInEmail({
    body: {
      email: SHARED_AUTH_EMAIL,
      password: input.password,
    },
    asResponse: true,
  });

  if (signInResponse.ok) {
    // Close sign-up on reboots when the account already exists and password is valid.
    input.authRuntime.closeBootstrapSignup();
    return;
  }

  throw new Error(
    "Failed to bootstrap shared auth account. Shared account may already exist with a different password."
  );
};
