import { createGoodchat } from "@goodchat/core";
import { config } from "./config";
import { goodchat } from "./goodchat";

const { app } = await createGoodchat(goodchat);

if (!goodchat.isServerless) {
  app.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
  });
}

export default app;
