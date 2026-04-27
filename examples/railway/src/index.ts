import "./env";
import { goodchat } from "./goodchat";
import { serve } from "./serve";

const { app } = await goodchat.ready;
await serve(app);
export default app;
