import { app } from "./app";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";
const port = Number(process.env.PORT ?? 3000);
const serverApp = app;

if (!isServerless) {
  serverApp.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

export default serverApp;
export type { App } from "./app";
