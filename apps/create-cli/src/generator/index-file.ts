import type { DeploymentTarget } from "../deployment-targets";

export const renderIndexFile = (
  isServerless: boolean,
  deploymentTarget?: DeploymentTarget
): string => {
  if (isServerless) {
    if (deploymentTarget === "vercel") {
      return `import "./env.js";
import { goodchat } from "./goodchat.js";
// @ts-ignore TS6133: required for vercel platform detection
import { Elysia } from "elysia";
import { serve } from "./serve";

const { app } = await goodchat.ready;

if (process.env.VERCEL !== "1" && process.env.__VERCEL_DEV_RUNNING !== "1") {
  await serve(app);
}

export default app;
`;
    }

    return `import "./env";
import { goodchat } from "./goodchat";

const { app } = await goodchat.ready;

export default app;
`;
  }

  return `import "./env";
import { goodchat } from "./goodchat";
import { serve } from "./serve";

const { app } = await goodchat.ready;
await serve(app);
export default app;
`;
};
