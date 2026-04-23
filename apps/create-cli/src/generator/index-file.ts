import type { DeploymentTarget } from "../deployment-targets";

export const renderIndexFile = (
  isServerless: boolean,
  deploymentTarget?: DeploymentTarget
): string => {
  if (isServerless) {
    if (deploymentTarget === "vercel") {
      return `import "./env";
import { goodchat } from "./goodchat";
// @ts-ignore TS6133: required for vercel platform detection
import { Elysia } from "elysia";

const port = Number(process.env.PORT ?? 3000);
const { app } = await goodchat.ready;

if (process.env.VERCEL !== "1" && process.env.__VERCEL_DEV_RUNNING !== "1") {
  app.listen(port, () => {
    console.log(\`Server is running on http://localhost:\${port}\`);
  });
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

const port = Number(process.env.PORT ?? 3000);
const { app } = await goodchat.ready;

app.listen(port, () => {
  console.log(\`Server is running on http://localhost:\${port}\`);
});

export default app;
`;
};
