import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env";
import contactRoutes from "./routes/contactRoutes";
import { leadLimiter, globalLimiter } from "./middleware/rateLimit";

export function createApp(): Application {
  const app = express();

  // Behind a proxy (Render, Railway, nginx) req.ip is the proxy address
  // without this, which would collapse every rate-limit bucket into one.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Security headers. docs/SECURITY_ARCHITECTURE.md §9
  // frameguard is DENY rather than helmet's SAMEORIGIN default: nothing here
  // is ever legitimately framed.
  app.use(helmet({ frameguard: { action: "deny" } }));

  // Origin allowlist. Replaces the previous unrestricted cors().
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

  // A lead payload is a few hundred bytes; 100kb is generous and stops
  // memory-exhaustion attempts.
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ limit: "100kb", extended: false }));

  app.use(globalLimiter);

  app.use("/api/contact", leadLimiter, contactRoutes);

  app.get("/", (_req: Request, res: Response) => {
    res.send("Dhudhat DEF API is running...");
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: "Route not found.",
      errorCode: "NOT_FOUND",
    });
  });

  // CORS rejections arrive here as thrown errors. Without this they surface
  // as an unhandled 500 carrying a stack trace.
  // Replaced by the typed AppError handler in Phase 1B.
  app.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
      if (err && err.message === "Not allowed by CORS") {
        res.status(403).json({
          success: false,
          message: "Origin not allowed.",
          errorCode: "FORBIDDEN",
        });
        return;
      }
      console.error(err);
      res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again later.",
        errorCode: "INTERNAL_ERROR",
      });
    }
  );

  return app;
}
