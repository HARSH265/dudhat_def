import type { Model } from "mongoose";
import User from "./User";
import RefreshToken from "./RefreshToken";
import ActivityLog from "./ActivityLog";
import Lead from "./Lead";
import LeadActivity from "./LeadActivity";
import Settings from "./Settings";
import Counter from "./Counter";
import Media from "./Media";

/**
 * Single registry of every model. Used by the index sync script and the
 * startup index assertion, so a new model cannot be added without both
 * noticing it. Phase 1 review H1.
 */
export const MODELS: Record<string, Model<never>> = {
  User: User as unknown as Model<never>,
  RefreshToken: RefreshToken as unknown as Model<never>,
  ActivityLog: ActivityLog as unknown as Model<never>,
  Lead: Lead as unknown as Model<never>,
  LeadActivity: LeadActivity as unknown as Model<never>,
  Settings: Settings as unknown as Model<never>,
  Counter: Counter as unknown as Model<never>,
  Media: Media as unknown as Model<never>,
};

/**
 * Importing this module registers every schema with Mongoose. Scripts that
 * only touch one model still need the rest registered for `ref` resolution.
 */
export function registerModels(): void {
  // The imports above are the registration; this exists so callers have an
  // explicit, greppable call rather than relying on import side effects.
}

export {
  User,
  RefreshToken,
  ActivityLog,
  Lead,
  LeadActivity,
  Settings,
  Counter,
  Media,
};
