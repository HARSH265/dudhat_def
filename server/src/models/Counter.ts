import mongoose, { Schema, type Document, type Model } from "mongoose";

// Document<string> because the counter is keyed by name ("lead-2026"),
// not an ObjectId.
export interface ICounter extends Document<string> {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter: Model<ICounter> = mongoose.model<ICounter>(
  "Counter",
  counterSchema
);

/**
 * Atomic sequence. Lead numbers must never come from countDocuments(), which
 * races under concurrent submissions and produces duplicates.
 * docs/DATABASE_ARCHITECTURE.md §5.7
 */
export async function nextSequence(key: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

export default Counter;
