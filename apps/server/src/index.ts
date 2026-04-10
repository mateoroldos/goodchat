import { config } from "./config";
import { goodchat } from "./goodchat";

const { app } = await goodchat.ready;

if (!config.isServerless) {
  app.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
  });
}

export default app;
