import { createServer } from "node:net";
import type { Elysia } from "elysia";

const AMB = "\x1b[38;2;255;163;10m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

const isAvailable = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });

export const serve = async (app: Elysia): Promise<void> => {
  const desired = Number(process.env.PORT ?? 3000);
  let port = desired;
  while (!(await isAvailable(port))) port++;
  app.listen(port);
  const bump = port === desired ? "" : `${DIM}:${desired} in use → ${RST}`;
  process.stdout.write(
    `\n  ${AMB}${BOLD}◆ goodchat${RST}  ${bump}http://localhost:${port}\n\n`
  );
};
