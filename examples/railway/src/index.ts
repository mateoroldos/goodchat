import "./env";
import { goodchat } from "./goodchat";

const port = Number(process.env.PORT ?? 3000);

const { app } = await goodchat.ready;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export default app;
