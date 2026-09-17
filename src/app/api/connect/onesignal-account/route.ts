import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadOwnerConnectSettings } from "@/infrastructure/owner-settings";
import {
  deleteOneSignalConnection,
  listOneSignalConnections,
  resolveComposioKey,
  resolveEntityId,
} from "@/infrastructure/composio";

// DELETE /api/connect/onesignal-account — remove one of the owner's OneSignal
// connected accounts (prune broken duplicates down to a single working one).
// Body: { accountId: string }. The account must belong to the caller's own
// entity, otherwise 404.
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { accountId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const accountId = body.accountId?.trim() ?? "";
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const settings = await loadOwnerConnectSettings(userId);
  let apiKey: string;
  try {
    apiKey = resolveComposioKey(settings.composioKey);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Composio not configured" },
      { status: 503 },
    );
  }
  const entityId = resolveEntityId(settings.composioUser);

  try {
    // Ownership check: only delete what is listed under this entity.
    const owned = await listOneSignalConnections(apiKey, entityId);
    if (!owned.some((a) => a.id === accountId)) {
      return NextResponse.json({ error: "account not found for this owner" }, { status: 404 });
    }
    await deleteOneSignalConnection(apiKey, accountId);
    const remaining = await listOneSignalConnections(apiKey, entityId).catch(() => []);
    return NextResponse.json({ deleted: true, remaining: remaining.length });
  } catch (e: unknown) {
    const status =
      typeof (e as { status?: unknown })?.status === "number"
        ? (e as { status: number }).status
        : 502;
    return NextResponse.json(
      { error: e instanceof Error && e.message ? e.message.slice(0, 500) : "delete failed" },
      { status },
    );
  }
}
