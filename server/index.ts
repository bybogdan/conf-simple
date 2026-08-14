import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { openDatabase } from "./database.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = process.env.APP_DATA_DIR ?? path.join(projectRoot, "data");
const port = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === "production";
const database = openDatabase(dataDirectory);
const app = createApp(database, {
  clientDirectory: isProduction ? path.join(projectRoot, "dist/client") : undefined,
  secureCookies: process.env.SECURE_COOKIES === "true",
});

const vite = isProduction
  ? null
  : await (await import("vite")).createServer({
      root: projectRoot,
      server: { middlewareMode: true },
      appType: "spa",
    });
if (vite) app.use(vite.middlewares);

const server = app.listen(port, () => {
  console.log(`Conf Simple listening on http://0.0.0.0:${port}`);
  console.log(`Persistent data: ${dataDirectory}`);
});

function shutdown() {
  server.close(async () => {
    await vite?.close();
    database.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
