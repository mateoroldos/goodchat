import { describe, expect, it } from "vitest";
import { renderIndexFile } from "./index-file";

describe("index file renderer", () => {
  it("renders serverless index without listener", () => {
    const content = renderIndexFile(true);

    expect(content).toContain('import "./env";');
    expect(content).toContain("const { app } = await goodchat.ready;");
    expect(content).toContain("export default app;");
    expect(content).not.toContain("app.listen(");
    expect(content).not.toContain("const port = Number");
    expect(content).not.toContain('import { Elysia } from "elysia";');
  });

  it("renders vercel serverless index with Elysia import", () => {
    const content = renderIndexFile(true, "vercel");

    expect(content).toContain('import "./env.js";');
    expect(content).toContain('import { goodchat } from "./goodchat.js";');
    expect(content).toContain(
      "// @ts-ignore TS6133: required for vercel platform detection"
    );
    expect(content).toContain('import { Elysia } from "elysia";');
    expect(content).toContain(
      'if (process.env.VERCEL !== "1" && process.env.__VERCEL_DEV_RUNNING !== "1")'
    );
    expect(content).toContain("const { app } = await goodchat.ready;");
    expect(content).toContain("export default app;");
    expect(content).toContain("app.listen(port");
  });

  it("renders runtime index with listener", () => {
    const content = renderIndexFile(false);

    expect(content).toContain('import "./env";');
    expect(content).toContain("const port = Number(process.env.PORT ?? 3000);");
    expect(content).toContain("app.listen(port");
    expect(content).toContain("export default app;");
  });
});
