import { app } from "./app";
import { config } from "./config";

const serverApp = app;

if (!config.isServerless) {
  serverApp.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
  });
}

export default serverApp;
