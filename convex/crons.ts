import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Daily sweep over tracked invoices. Queue-only: the sweep creates
// pending_approval rows via sweepAllOwners and NEVER sends anything.
// Sending requires explicit human approval per reminder
// (workbench Approve+Send -> POST /api/reminders/send).
const crons = cronJobs();

crons.daily(
  "daily reminder sweep",
  { hourUTC: 9, minuteUTC: 5 },
  // Cast: api.d.ts regenerates on `npx convex dev`/deploy to include reminders.
  (internal as any).reminders.sweepAllOwners,
  {},
);

export default crons;
