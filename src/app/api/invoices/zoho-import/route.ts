import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadOwnerConnectSettings } from "@/infrastructure/owner-settings";
import {
  fetchZohoInvoices,
  MissingComposioConfigError,
  ChannelNotConnectedError,
  OneSignalAuthError,
} from "@/infrastructure/composio";

// POST /api/invoices/zoho-import — alternative invoice source to CSV upload.
// Pulls the owner's invoices from Zoho Invoice through their own Composio
// connection (read-only) and returns normalized rows shaped exactly like the
// workbench CSV flow. Nothing is stored and nothing is sent here: the client
// fills the CSV box and the human still presses "Follow up" (credits) and
// approves every reminder. Invariant preserved.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { organizationId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body optional — org id comes from owner settings when omitted.
  }

  const settings = await loadOwnerConnectSettings(userId);
  let apiKey: string;
  try {
    apiKey = settings.composioKey ?? process.env.COMPOSIO_API_KEY ?? "";
    if (!apiKey.trim()) throw new MissingComposioConfigError();
  } catch {
    return NextResponse.json(
      { error: "Composio API key not configured — save it in /connect first" },
      { status: 503 },
    );
  }

  try {
    const result = await fetchZohoInvoices({
      apiKey,
      entityId: settings.composioUser ?? "default",
      organizationId: body?.organizationId?.trim() || settings.zohoOrgId,
      preferredAccountId: settings.zohoAccountId ?? null,
    });
    // Best-effort audit entry: an import happened (metadata only, no payloads).
    try {
      const { ConvexHttpClient } = await import("convex/browser");
      const { api } = await import("../../../../../convex/_generated/api");
      const client = new ConvexHttpClient(
        (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\/+$/, ""),
      );
      await client.mutation((api as any).vault.add, {
        ownerClerkId: userId,
        kind: "zoho_import",
        title: `Zoho import — ${result.invoices.length} invoice(s)`,
        payload: JSON.stringify({
          count: result.invoices.length,
          skipped: result.skipped.length,
          tool: result.tool,
          connectedAccountId: result.accountId,
          timestamp: Date.now(),
        }),
      });
    } catch {
      // Best effort audit: the import result is what matters.
    }
    return NextResponse.json({
      invoices: result.invoices,
      skipped: result.skipped,
      tool: result.tool,
      accountId: result.accountId,
      organizationId: result.organizationId,
    });
  } catch (e: unknown) {
    const status =
      e instanceof MissingComposioConfigError
        ? 503
        : e instanceof ChannelNotConnectedError
          ? 502
          : e instanceof OneSignalAuthError
            ? 502
            : 502;
    const message = e instanceof Error && e.message ? e.message.slice(0, 1000) : "zoho import failed";
    return NextResponse.json({ error: message }, { status });
  }
}
