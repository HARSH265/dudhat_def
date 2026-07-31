import mongoose from "mongoose";
import { env, isProduction } from "./env";
import { MODELS } from "../models";

// Reject unknown query operators at the schema level and coerce filter values
// so a crafted query string cannot inject a MongoDB operator.
// docs/SECURITY_ARCHITECTURE.md §6
mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);

// Index creation is a startup cost and a production hazard. Applied by an
// explicit migration step instead. docs/DATABASE_ARCHITECTURE.md §6
mongoose.set("autoIndex", !isProduction);

export async function connectDB(): Promise<void> {
  mongoose.connection.on("connected", () => {
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  });

  mongoose.connection.on("error", (error: Error) => {
    console.error(`MongoDB error: ${error.message}`);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });

  // Previously this swallowed the failure and called process.exit(1), which
  // killed the process before anything could report why. Now it rejects and
  // the bootstrap decides.
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close(false);
  console.log("MongoDB connection closed");
}

/**
 * Phase 1 review H1: with autoIndex off in production, a deploy that skips
 * the index migration silently loses every unique constraint and both TTL
 * policies. Fail at boot rather than discover it when duplicate lead numbers
 * appear.
 *
 * Compares declared indexes against what the database actually has.
 */
export async function assertIndexes(): Promise<void> {
  const missing: string[] = [];

  for (const [name, model] of Object.entries(MODELS)) {
    const declared = model.schema.indexes().length + 1; // +1 for _id
    let actual = 0;
    try {
      actual = (await model.collection.indexes()).length;
    } catch {
      actual = 0; // collection not created yet
    }
    if (actual < declared) {
      missing.push(`${name} (${actual}/${declared})`);
    }
  }

  if (missing.length === 0) return;

  const detail = missing.join(", ");
  if (isProduction) {
    throw new Error(
      `Indexes are missing or incomplete: ${detail}. ` +
        `Run "npm run sync:indexes" as a deploy step before starting the server.`
    );
  }
  console.warn(`[db] Index check: ${detail}. Run "npm run sync:indexes".`);
}
