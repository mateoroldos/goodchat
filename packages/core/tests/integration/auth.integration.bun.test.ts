import { describe, expect, it } from "bun:test";
import { createGoodchatHarness } from "../harness/create-goodchat-harness";

const getSetCookieHeaders = (response: Response): string[] => {
  const responseHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof responseHeaders.getSetCookie === "function") {
    return responseHeaders.getSetCookie();
  }

  const setCookie = response.headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
};

const updateCookieJar = (
  cookieJar: Map<string, string>,
  response: Response
): void => {
  const setCookies = getSetCookieHeaders(response);
  for (const setCookie of setCookies) {
    const [cookiePair] = setCookie.split(";");
    if (!cookiePair) {
      continue;
    }

    const separatorIndex = cookiePair.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const cookieName = cookiePair.slice(0, separatorIndex).trim();
    const cookieValue = cookiePair.slice(separatorIndex + 1).trim();

    if (!cookieValue) {
      cookieJar.delete(cookieName);
      continue;
    }

    cookieJar.set(cookieName, cookieValue);
  }
};

const buildCookieHeader = (cookieJar: Map<string, string>): string => {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
};

const createJsonRequest = (input: {
  path: string;
  body?: Record<string, string>;
  method: "GET" | "POST";
  cookieJar?: Map<string, string>;
}): Request => {
  const headers = new Headers();
  if (input.body) {
    headers.set("content-type", "application/json");
  }

  if (input.cookieJar && input.cookieJar.size > 0) {
    headers.set("cookie", buildCookieHeader(input.cookieJar));
  }

  return new Request(`http://localhost${input.path}`, {
    method: input.method,
    headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
};

describe("createGoodchat Better Auth integration", () => {
  it("supports mounted email/password and session endpoints", async () => {
    const harness = await createGoodchatHarness();

    try {
      const cookieJar = new Map<string, string>();

      const initialSessionResponse = await harness.app.handle(
        createJsonRequest({ method: "GET", path: "/api/auth/get-session" })
      );
      expect(initialSessionResponse.status).toBe(200);
      expect(await initialSessionResponse.json()).toBeNull();

      const invalidEmailSignInResponse = await harness.app.handle(
        createJsonRequest({
          method: "POST",
          path: "/api/auth/sign-in/email",
          body: {
            email: "someone@example.com",
            password: harness.authPassword,
          },
        })
      );
      expect(invalidEmailSignInResponse.status).toBe(400);

      const signInResponse = await harness.app.handle(
        createJsonRequest({
          method: "POST",
          path: "/api/auth/sign-in/email",
          body: {
            email: harness.sharedEmail,
            password: harness.authPassword,
          },
        })
      );
      expect(signInResponse.status).toBe(200);
      updateCookieJar(cookieJar, signInResponse);
      expect(cookieJar.size).toBeGreaterThan(0);

      const signedInSessionResponse = await harness.app.handle(
        createJsonRequest({
          method: "GET",
          path: "/api/auth/get-session",
          cookieJar,
        })
      );
      expect(signedInSessionResponse.status).toBe(200);
      const signedInSession = (await signedInSessionResponse.json()) as {
        user?: { email?: string };
      } | null;
      expect(signedInSession?.user?.email).toBe(harness.sharedEmail);

      const signOutResponse = await harness.app.handle(
        createJsonRequest({
          method: "POST",
          path: "/api/auth/sign-out",
          cookieJar,
        })
      );
      expect(signOutResponse.status).toBe(200);
      updateCookieJar(cookieJar, signOutResponse);

      const afterSignOutSessionResponse = await harness.app.handle(
        createJsonRequest({
          method: "GET",
          path: "/api/auth/get-session",
          cookieJar,
        })
      );
      expect(afterSignOutSessionResponse.status).toBe(200);
      expect(await afterSignOutSessionResponse.json()).toBeNull();

      const signUpAfterBootstrapResponse = await harness.app.handle(
        createJsonRequest({
          method: "POST",
          path: "/api/auth/sign-up/email",
          body: {
            email: harness.sharedEmail,
            password: harness.authPassword,
            name: "Owner",
          },
        })
      );
      expect(signUpAfterBootstrapResponse.status).toBe(400);
    } finally {
      await harness.close();
    }
  });
});
