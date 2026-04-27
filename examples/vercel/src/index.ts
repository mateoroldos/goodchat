import "./env.js";
import { goodchat } from "./goodchat.js";
// @ts-ignore TS6133: required for vercel platform detection
import { Elysia } from "elysia";
import { serve } from "./serve.js";

const { app } = await goodchat.ready;

if (process.env.VERCEL !== "1" && process.env.__VERCEL_DEV_RUNNING !== "1") {
  await serve(app);
}

export default app;
