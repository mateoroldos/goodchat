import { app } from "./app";

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

export type { App } from "./app";
