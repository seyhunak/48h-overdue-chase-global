// Infrastructure — owner-scoped connect settings reader (SERVER ONLY).
// /connect stores each owner's Composio API key, Composio username, and the
// OneSignal App ID on their own Convex settings row; every send route reads
// them back through here so keys never travel to the client.

import { getConvexUrl } from "./env";

export type OwnerConnectSettings = {
  composioKey: string | null;
  composioUser: string | null;
  onesignalAppId: string | null;
};

const EMPTY: OwnerConnectSettings = { composioKey: null, composioUser: null, onesignalAppId: null };

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function loadOwnerConnectSettings(ownerClerkId: string): Promise<OwnerConnectSettings> {
  const convexUrl = getConvexUrl();
  if (!convexUrl || !ownerClerkId) return EMPTY;
  try {
    const { ConvexHttpClient } = await import("convex/browser");
    const { api } = await import("../../convex/_generated/api");
    const client = new ConvexHttpClient(convexUrl);
    const row: any = await client.query((api as any).reminders.getSettings, { ownerClerkId });
    return {
      composioKey: clean(row?.composioKey),
      composioUser: clean(row?.composioUser),
      onesignalAppId: clean(row?.onesignalAppId),
    };
  } catch {
    // Best effort: a settings read failure degrades to env-configured mode.
    return EMPTY;
  }
}
