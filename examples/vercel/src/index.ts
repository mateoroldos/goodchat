import "./env.js";
import { goodchat } from "./goodchat.js";
// @ts-ignore TS6133: required for vercel platform detection
import { Elysia } from "elysia";

const port = Number(process.env.PORT ?? 3000);
const { app } = await goodchat.ready;

if (process.env.VERCEL !== "1" && process.env.__VERCEL_DEV_RUNNING !== "1") {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

export default app;
