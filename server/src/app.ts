import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import { env } from "./config/env";
import { logger } from "./config/logger";
import contactRoutes from "./routes/contactRoutes";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin";
import { leadLimiter, globalLimiter } from "./middleware/rateLimit";
import { requestId } from "./middleware/requestId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

/**
 * Middleware order is deliberate and documented.
 * docs/API_SPECIFICATION.md §6
 */
export function createApp(): Application {
  const app = express();

  // Behind a proxy (Render, Railway, nginx) req.ip is the proxy address
  // without this, which would collapse every rate-limit bucket into one.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // 1. Request correlation — first, so every later log line carries it.
  app.use(requestId);

  // 2. Security headers. frameguard DENY rather than helmet's SAMEORIGIN
  //    default: nothing here is ever legitimately framed.
  app.use(helmet({ frameguard: { action: "deny" } }));

  // 3. Origin allowlist. credentials:true is required by the refresh cookie
  //    in Phase 1C, and is only safe alongside an explicit allowlist.
  const allowedOrigins = [env.clientUrl, env.adminUrl];
  app.use(
    cors({
      origin: (origin, callback) => {
        // No origin: curl, server-to-server, same-origin. Not a browser
        // cross-origin request, so there is nothing here for CORS to protect.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );

  // 4-5. Body parsing. A lead payload is a few hundred bytes.
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ limit: "100kb", extended: false }));

  // Refresh token travels as an HttpOnly cookie.
  app.use(cookieParser());

  // 6. Strip $ and . from keys, so a crafted payload cannot smuggle a
  //    MongoDB operator into a query. docs/SECURITY_ARCHITECTURE.md §6
  app.use(mongoSanitize());

  // 7. HTTP parameter pollution — collapses ?a=1&a=2 to a single value.
  app.use(hpp());

  // 8. Compression.
  app.use(compression());

  // 9. Structured request logging, with redaction configured on the logger.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id ?? "unknown",
      // 4xx is a client problem, not a server incident.
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    })
  );

  // 10. Global rate limit.
  app.use(globalLimiter);

  // 11. maintenanceGuard — added in Phase 1D, once `settings` exists.

  // 12. Routes.
  //
  // Legacy alias, permanent. docs/API_SPECIFICATION.md §9
  app.use("/api/contact", leadLimiter, contactRoutes);

  // Versioned API.
  app.use("/api/v1/leads", leadLimiter, contactRoutes);
  app.use("/api/v1/admin/auth", authRoutes);
  app.use("/api/v1/admin", adminRoutes);

  app.get("/", (_req: Request, res: Response) => {
    res.send("Dudhat DEF API is running...");
  });

  // 13-14. Terminal handlers.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
