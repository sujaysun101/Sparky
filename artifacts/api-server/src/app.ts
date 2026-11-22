import fs from "fs";
import path from "path";
import express, { type Express, type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { HttpError } from "./lib/store";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
app.set("trust proxy", 1);

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
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cookieParser());
app.use(express.json({ limit: "64kb" }));
app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(
    getClerkProxyHost(req) ?? "",
    process.env.CLERK_PUBLISHABLE_KEY,
  ),
})));

app.use("/api", router);

const publicDir = process.env.PUBLIC_DIR
  ? path.resolve(process.env.PUBLIC_DIR)
  : path.resolve(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });
}
const handleError: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) { res.end(); return; }
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
  const status = err?.type === "entity.too.large" ? 413 : err instanceof SyntaxError ? 400 : 503;
  req.log.warn({ category: status === 503 ? "storage_or_service_failure" : "invalid_input" }, "Request failed");
  res.status(status).json({ error: status === 413 ? "Request exceeds the 64 KB limit." : status === 400 ? "Invalid JSON request." : "Your work could not be saved. Keep this tab open and retry. Nothing has been marked as saved." });
};
app.use(handleError);

export default app;
