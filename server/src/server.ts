// Apni server.js me sabse top par ise paste karein
import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import type { Server } from "node:http";
import { createApp } from "./app";
import { assertIndexes, connectDB, disconnectDB } from "./config/db";
import { env } from "./config/env";
import { registerModels } from "./models";

async function start(): Promise<void> {
  await connectDB();

  // Registers every schema, then verifies the database actually carries the
  // declared indexes. Phase 1 review H1.
  registerModels();
  await assertIndexes();

  const app = createApp();
  const server: Server = app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });

  // Close the HTTP server before the database so in-flight requests are not
  // cut off mid-query.
  const shutdown = (signal: string): void => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      void disconnectDB().finally(() => process.exit(0));
    });

    // Backstop: if a hung connection prevents close() from completing.
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start server: ${message}`);
  process.exit(1);
});
