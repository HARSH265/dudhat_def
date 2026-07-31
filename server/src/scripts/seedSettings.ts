import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import { connectDB, disconnectDB } from "../config/db";
import Settings from "../models/Settings";

/**
 * Migration M4: seeds the settings singleton from the values currently
 * hardcoded in Footer.jsx and Contact.jsx.
 *
 * Placeholders are carried forward VERBATIM rather than replaced with
 * plausible-looking fakes — a real-looking wrong address is more dangerous
 * than an obvious blank. docs/SEED_DATA.md §2
 *
 * Idempotent: existing settings are left untouched.
 */
async function main(): Promise<void> {
  await connectDB();

  const existing = await Settings.findOne({ key: "global" });
  if (existing) {
    console.log("Settings already exist. Nothing changed.");
    await disconnectDB();
    return;
  }

  await Settings.create({
    key: "global",
    company: {
      legalName: "Dudhat Industries Private Limited",
      brandName: "Dudhat DEF",
      tagline: "DRIVING CLEANER TOMORROW",
      about:
        "Dudhat Industries Private Limited is committed to delivering premium " +
        "quality DEF solutions for a cleaner environment and better tomorrow.",
    },
    contact: {
      phone: "[PLACEHOLDER] +91 12345 67890",
      whatsapp: "[PLACEHOLDER] +91 12345 67890",
      email: "[PLACEHOLDER] info@Dudhatdef.com",
      salesEmail: "[PLACEHOLDER] sales@Dudhatdef.com",
      website: "www.Dudhatdef.com",
    },
    address: {
      line1: "[PLACEHOLDER] Plot No. ___",
      line2: "[PLACEHOLDER] MIDC",
      city: "[PLACEHOLDER]",
      state: "Maharashtra",
      pincode: "[PLACEHOLDER]",
      country: "India",
      // Null, not 0 — see the model comment.
      latitude: null,
      longitude: null,
    },
    // Null renders no icon; "#" renders a dead one. The current footer has
    // four dead social links; the seed does not reproduce that defect.
    social: { facebook: null, linkedin: null, instagram: null, youtube: null },
    analytics: {},
    features: {
      blogEnabled: false,
      dealerNetworkEnabled: false,
      whatsappWidgetEnabled: false,
    },
    maintenanceMode: false,
  });

  console.log("Settings seeded.");
  console.log("Values marked [PLACEHOLDER] must be replaced before launch —");
  console.log("see docs/SEED_DATA.md §6 for the checklist.");

  await disconnectDB();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
