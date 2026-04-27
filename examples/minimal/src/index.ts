import "./env";
import { goodchat } from "./goodchat";
import { serve } from "./serve";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";
const { app } = await goodchat.ready;

if (!isServerless) await serve(app);

export default app;
