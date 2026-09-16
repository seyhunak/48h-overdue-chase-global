// Infrastructure — Composio multichannel dispatch (SERVER ONLY).
// Never import this module from client components. The API key is resolved
// per-owner from Convex settings with process.env.COMPOSIO_API_KEY fallback.
// Missing keys throw so route handlers can respond 503. Nothing here runs at
// build time (composio-core is lazily imported at request runtime).

export type Channel = "email" | "whatsapp" | "sms" | "voice";

export const CHANNELS: Channel[] = ["email", "whatsapp", "sms", "voice"];

export class MissingComposioConfigError extends Error {
  readonly status = 503;
  constructor(message = "Composio not configured (missing API key)") {
    super(message);
    this.name = "MissingComposioConfigError";
  }
}

export class ChannelNotConnectedError extends Error {
  readonly status = 502;
  constructor(channel: Channel) {
    super(`${channel} channel not connected — connect it in /connect`);
    this.name = "ChannelNotConnectedError";
  }
}

export function resolveComposioKey(settingsKey?: string | null): string {
  const fromSettings = typeof settingsKey === "string" ? settingsKey.trim() : "";
  if (fromSettings) return fromSettings;
  const fromEnv = process.env.COMPOSIO_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  throw new MissingComposioConfigError();
}

export function resolveEntityId(settingsUser?: string | null, override?: string | null): string {
  const o = typeof override === "string" ? override.trim() : "";
  if (o) return o;
  const s = typeof settingsUser === "string" ? settingsUser.trim() : "";
  return s || "default";
}

async function loadComposio(apiKey: string) {
  // Lazy import keeps composio-core out of the client bundle and out of
  // build-time evaluation (build must pass with zero env keys).
  const { Composio } = await import("composio-core");
  return new Composio({ apiKey });
}

export async function listConnectedAccountApps(
  apiKey: string,
  entityId: string,
): Promise<string[]> {
  const client = await loadComposio(apiKey);
  // Prefer entity-scoped listing; fall back to global list.
  try {
    const entity = client.getEntity(entityId);
    const conns = await entity.getConnections();
    const items = Array.isArray(conns) ? conns : (conns as any)?.items ?? [];
    const names: string[] = items
      .map((c: any) => String(c?.appName ?? c?.appUniqueId ?? ""))
      .filter((n: string) => Boolean(n));
    return [...new Set(names)];
  } catch {
    const res = await client.connectedAccounts.list({
      entityId,
      showActiveOnly: false,
    } as any);
    const items = (res as any)?.items ?? [];
    const names: string[] = items
      .map((c: any) => String(c?.appName ?? c?.appUniqueId ?? ""))
      .filter((n: string) => Boolean(n));
    return [...new Set(names)];
  }
}

// Channel -> app-name matchers used to find the owner's connected account.
const CHANNEL_APP_MATCHERS: Record<Exclude<Channel, "email">, RegExp> = {
  whatsapp: /whatsapp/i,
  sms: /sms|twilio|vonage|plivo|messagebird|telnyx/i,
  voice: /voice|call|twilio|vapi|vonage|plivo|exotel|aircall/i,
};

// Best-known action slugs if runtime tool-list resolution finds nothing.
const FALLBACK_ACTIONS: Record<Exclude<Channel, "email">, string[]> = {
  whatsapp: ["WHATSAPP_SEND_MESSAGE", "WHATSAPP_SEND_TEXT_MESSAGE", "WHATSAPP_SEND_TEMPLATE_MESSAGE"],
  sms: ["TWILIO_SEND_SMS", "TWILIO_SEND_MESSAGE", "VONAGE_SEND_SMS", "PLIVO_SEND_SMS"],
  voice: ["TWILIO_MAKE_CALL", "TWILIO_CREATE_CALL", "VAPI_CREATE_CALL", "VONAGE_MAKE_CALL"],
};

async function findConnectedAccountForChannel(
  client: any,
  entityId: string,
  channel: Exclude<Channel, "email">,
): Promise<{ id: string; appName: string } | null> {
  const matcher = CHANNEL_APP_MATCHERS[channel];
  try {
    const entity = client.getEntity(entityId);
    const conns = await entity.getConnections();
    const items: any[] = Array.isArray(conns) ? conns : (conns as any)?.items ?? [];
    for (const c of items) {
      const appName = String(c?.appName ?? c?.appUniqueId ?? "");
      const status = String(c?.status ?? "ACTIVE").toUpperCase();
      if (!matcher.test(appName)) continue;
      if (status && status !== "ACTIVE" && status !== "ENABLED") continue;
      const id = String(c?.id ?? c?.connectedAccountId ?? "");
      if (id) return { id, appName };
    }
  } catch {
    // Fall through to global list.
  }
  try {
    const res = await client.connectedAccounts.list({ entityId } as any);
    const items: any[] = (res as any)?.items ?? [];
    for (const c of items) {
      const appName = String(c?.appName ?? "");
      if (!matcher.test(appName)) continue;
      const id = String(c?.id ?? "");
      if (id) return { id, appName };
    }
  } catch {
    return null;
  }
  return null;
}

async function resolveActionSlug(
  client: any,
  appName: string,
  channel: Exclude<Channel, "email">,
): Promise<string> {
  // Resolve action slugs from the installed composio-core version's tool
  // list at runtime where possible.
  try {
    const res = await client.actions.list({ apps: appName.toLowerCase() } as any);
    const items: any[] = (res as any)?.items ?? [];
    const names = items.map((a: any) => String(a?.name ?? ""));
    const want =
      channel === "whatsapp"
        ? [/whatsapp.*send.*message/i, /send.*message/i]
        : channel === "sms"
          ? [/send.*sms/i, /send.*message/i, /send.*text/i]
          : [/make.*call/i, /create.*call/i, /initiate.*call/i, /outbound.*call/i];
    for (const re of want) {
      const hit = names.find((n) => re.test(n));
      if (hit) return hit;
    }
    if (names.length > 0 && channel === "whatsapp") return names[0];
  } catch {
    // Fall through to best-known slugs.
  }
  return FALLBACK_ACTIONS[channel][0];
}

export type DispatchInput = {
  subject: string;
  body: string;
  to?: string;
  recipientEmail?: string;
};

function buildChannelText(input: DispatchInput): string {
  return input.subject ? `${input.subject}\n\n${input.body}` : input.body;
}

export async function dispatchViaComposio(opts: {
  apiKey: string;
  entityId: string;
  channel: Exclude<Channel, "email">;
  input: DispatchInput;
}): Promise<{ actionName: string; appName: string; data: unknown }> {
  const client = await loadComposio(opts.apiKey);
  const account = await findConnectedAccountForChannel(client, opts.entityId, opts.channel);
  if (!account) throw new ChannelNotConnectedError(opts.channel);
  const actionName = await resolveActionSlug(client, account.appName, opts.channel);
  const text = buildChannelText(opts.input);
  const to = (opts.input.to ?? opts.input.recipientEmail ?? "").trim();
  // Input shapes differ per app; send a superset — unknown keys are ignored
  // by most actions, and failures surface as 502 with the provider message.
  const input: Record<string, unknown> = {
    text,
    message: text,
    body: text,
    to,
    recipient: to,
    phone_number: to,
    to_number: to,
    recipient_number: to,
  };
  if (opts.channel === "voice") {
    input.script = text;
    input.message_body = text;
  }
  try {
    const res = await client.actions.execute({
      actionName,
      requestBody: { connectedAccountId: account.id, input, appName: account.appName },
    } as any);
    if (res && typeof res === "object" && "successful" in res && !(res as any).successful) {
      const msg = String((res as any).error ?? `action ${actionName} failed`);
      if (/not (found|connected|enabled)|no .*account|unauthorized|forbidden/i.test(msg)) {
        throw new ChannelNotConnectedError(opts.channel);
      }
      const err = new Error(msg) as Error & { status?: number };
      err.status = 502;
      throw err;
    }
    return { actionName, appName: account.appName, data: (res as any)?.data ?? res };
  } catch (e: any) {
    if (e instanceof ChannelNotConnectedError) throw e;
    const msg = String(e?.message ?? "composio dispatch failed");
    if (/not (found|connected|enabled)|no .*account|401|403|404/i.test(msg) && /account|connect|auth/i.test(msg)) {
      throw new ChannelNotConnectedError(opts.channel);
    }
    const err = new Error(msg) as Error & { status?: number };
    err.status = typeof e?.status === "number" ? e.status : 502;
    throw err;
  }
}
