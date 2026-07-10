import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// 25mb accommodates base64-encoded invoice photos/PDFs posted to /ai-invoice.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use("/api", router);

// Production static serving (single-service deploys, e.g. Railway):
// if a SPA build was copied to dist/public, serve it with an index.html
// fallback for client-side routes. On Replit this folder does not exist
// (the frontend runs as its own artifact), so behavior is unchanged there.
// `__dirname` is injected into the esbuild bundle banner (see build.mjs).
const spaDir =
  process.env.SPA_DIR ??
  path.join(
    typeof __dirname !== "undefined" ? __dirname : process.cwd(),
    "public",
  );

if (fs.existsSync(path.join(spaDir, "index.html"))) {
  logger.info({ spaDir }, "Serving SPA static assets");
  app.use(express.static(spaDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(spaDir, "index.html"));
  });
}

export default app;
