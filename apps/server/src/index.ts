import { cors } from "@elysiajs/cors";
import { env } from "@goodchat/env/server";
import { Elysia } from "elysia";

const _app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"],
    })
  )
  .get("/", () => "OK")
  .listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
