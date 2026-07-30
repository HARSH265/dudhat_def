// Apni server.js me sabse top par ise paste karein
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const contactRoutes = require("./routes/contactRoutes");
const { leadLimiter, globalLimiter } = require("./middleware/rateLimit");

dotenv.config();
connectDB();

const app = express();

// Behind a proxy (Render, Railway, nginx) req.ip is the proxy address without
// this, which would collapse every rate-limit bucket into one global bucket.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Security headers. docs/SECURITY_ARCHITECTURE.md §9
app.use(helmet());

// Origin allowlist. Replaces the previous unrestricted cors().
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3000",
  process.env.ADMIN_URL || "http://localhost:5173",
];

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

// Body limits. A lead payload is a few hundred bytes; 100kb is generous and
// stops memory-exhaustion attempts.
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ limit: "100kb", extended: false }));

app.use(globalLimiter);

// Routes
app.use("/api/contact", leadLimiter, contactRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Dhudhat DEF API is running...");
});

// CORS rejections arrive here as thrown errors. Without this they surface as
// an unhandled 500 carrying a stack trace.
app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed.",
      errorCode: "FORBIDDEN",
    });
  }
  console.error(err);
  return res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again later.",
    errorCode: "INTERNAL_ERROR",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
