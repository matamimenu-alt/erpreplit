import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

 claude/code-review-fixes-4nzn85
// ── Serve the built SPA (single-service deployment) ─────────────────────────
// The API routes above take precedence. Every other GET falls back to the
// SPA's index.html so client-side (Wouter) routing works on deep links / refresh.
// Default location resolves the frontend build relative to this bundle
// (artifacts/api-server/dist → artifacts/restaurant-mgmt/dist/public); override
// with STATIC_DIR if the layout differs.
const here = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.resolve(here, "../../restaurant-mgmt/dist/public");

if (existsSync(path.join(staticDir, "index.html"))) {
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(staticDir, "index.html"));
  });
  logger.info({ staticDir }, "Serving SPA static build");
} else {
  logger.warn({ staticDir }, "SPA build not found — running API only");
=======
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
 main
}

export default app;
