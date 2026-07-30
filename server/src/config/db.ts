import mongoose from "mongoose";
import { env, isProduction } from "./env";

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
