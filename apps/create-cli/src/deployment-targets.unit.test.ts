import { describe, expect, it } from "vitest";
import { DEPLOYMENT_PROFILES } from "./deployment-profiles";

describe("deployment target database constraints", () => {
  it("allows sqlite for docker and railway", () => {
    expect(DEPLOYMENT_PROFILES.docker.allowedDialects).toContain("sqlite");
    expect(DEPLOYMENT_PROFILES.railway.allowedDialects).toContain("sqlite");
  });

  it("blocks sqlite for vercel", () => {
    expect(DEPLOYMENT_PROFILES.vercel.allowedDialects).toEqual([
      "postgres",
      "mysql",
    ]);
  });
});
