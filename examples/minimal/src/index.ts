import "./env";
import { goodchat } from "./goodchat";

const port = Number(process.env.PORT ?? 3000);
const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";
const { app } = await goodchat.ready;

if (!isServerless) {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

export default app;
