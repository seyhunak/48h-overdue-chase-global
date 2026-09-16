// Infrastructure — Composio multichannel dispatch (SERVER ONLY).
// Never import this module from client components. The API key is resolved
// per-owner from Convex settings with process.env.COMPOSIO_API_KEY fallback.
// Missing keys throw so route handlers can respond 503. Nothing here runs at
// build time (direct fetch only — no composio-core SDK, so auth/entity error
// responses can never surface as raw TypeErrors).

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

const COMPOSIO_BASE = "https://backend.composio.dev";

// ---------- Internal: total TypeError-proof helpers ----------

function messageOf(value: unknown, fallback: string): string {
  if (value instanceof Error) {
    try {
      const m = typeof value.message === "string" ? value.message.trim() : "";
      if (m) return m.slice(0, 1000);
    } catch {
      // ignore and fall through
    }
    return fallback;
  }
  if (typeof value === "string") {
    const s = value.trim();
    return (s || fallback).slice(0, 1000);
  }
  if (value === null || value === undefined) return fallback;
  try {
    const maybeMsg = (value as { message?: unknown })?.message;
    if (typeof maybeMsg === "string" && maybeMsg.trim()) return maybeMsg.trim().slice(0, 1000);
  } catch {
    // ignore
  }
  try {
    const s = String(value);
    if (s && s !== "[object Object]") return s.slice(0, 1000);
    return `${fallback}: ${JSON.stringify(value)}`.slice(0, 1000);
  } catch {
    return fallback;
  }
}

function statusOf(value: unknown): number | undefined {
  try {
    const s = (value as { status?: unknown })?.status;
    if (typeof s === "number" && Number.isFinite(s) && s >= 100 && s < 600) return s;
  } catch {
    // ignore
  }
  return undefined;
}

function toStatusError(value: unknown, fallbackMsg: string, fallbackStatus = 502): Error & { status?: number } {
  if (value instanceof ChannelNotConnectedError) return value;
  if (value instanceof MissingComposioConfigError) return value;
  const msg = messageOf(value, fallbackMsg);
  const st = statusOf(value) ?? fallbackStatus;
  const err = new Error(msg) as Error & { status?: number };
  err.status = st;
  return err;
}

function isNotConnectedOrAuth(msg: string, status?: number): boolean {
  try {
    if (/not (found|connected|enabled)|no .*account|unauthorized|forbidden|invalid[\s_\-]*(api[\s_\-]*)?key|auth/i.test(msg)) {
      return true;
    }
    if ((status === 401 || status === 403 || status === 404) && /account|connect|auth|key|entity/i.test(msg)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const text = await res.text();
    if (!text) return {};
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      return { _raw: String(parsed ?? "").slice(0, 1000) };
    } catch {
      return { _raw: text.slice(0, 1000) };
    }
  } catch {
    return {};
  }
}

function providerMessage(json: Record<string, unknown>, fallback: string): string {
  try {
    const keys = ["message", "error", "err", "detail", "details", "msg", "reason"] as const;
    for (const k of keys) {
      const v: unknown = json?.[k];
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, 1000);
      if (Array.isArray(v)) {
        const first = v.map((x) => (typeof x === "string" ? x : (x as { message?: unknown })?.message)).find((x) => typeof x === "string" && (x as string).trim());
        if (typeof first === "string" && first.trim()) return first.trim().slice(0, 1000);
      }
      if (v && typeof v === "object") {
        try {
          const inner = (v as { message?: unknown })?.message;
          if (typeof inner === "string" && inner.trim()) return inner.trim().slice(0, 1000);
        } catch {
          // ignore
        }
      }
    }
    const raw = json?.["_raw"];
    if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 1000);
  } catch {
    // ignore
  }
  return fallback;
}

async function fetchConnectedAccountItems(apiKey: string, entityId: string): Promise<unknown[]> {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) throw new MissingComposioConfigError();
  const eid = typeof entityId === "string" && entityId.trim() ? entityId.trim() : "default";
  let res: Response;
  try {
    res = await fetch(
      `${COMPOSIO_BASE}/api/v3/connected_accounts/list?entity_id=${encodeURIComponent(eid)}&show_active_only=false`,
      { method: "GET", headers: { "x-api-key": key }, cache: "no-store" },
    );
  } catch {
    throw Object.assign(new Error("composio unreachable"), { status: 502 });
  }
  if (!res.ok) {
    let msg: string;
    try {
      const json = await safeJson(res);
      msg = providerMessage(json, `composio verify failed (status ${res.status})`);
    } catch {
      msg = `composio verify failed (status ${res.status})`;
    }
    const full = msg.includes(String(res.status)) ? msg : `composio verify failed (status ${res.status}): ${msg}`;
    throw Object.assign(new Error(full.slice(0, 1000)), { status: res.status });
  }
  let json: Record<string, unknown>;
  try {
    json = await safeJson(res);
  } catch {
    return [];
  }
  try {
    const maybeItems: unknown =
      (json as { items?: unknown })?.items ??
      (json as { data?: { items?: unknown } })?.data?.items ??
      (json as { connectedAccounts?: unknown })?.connectedAccounts ??
      [];
    if (Array.isArray(maybeItems)) return maybeItems;
    if (Array.isArray(json as unknown as unknown[])) return json as unknown as unknown[];
    return [];
  } catch {
    return [];
  }
}

function appNamesOf(items: unknown[]): string[] {
  try {
    const names: string[] = [];
    for (const c of items) {
      try {
        const rec = c as { appName?: unknown; appUniqueId?: unknown } | null | undefined;
        const raw = rec?.appName ?? rec?.appUniqueId ?? "";
        const n = String(raw ?? "").trim();
        if (n) names.push(n);
      } catch {
        // skip one bad row, never throw
      }
    }
    return [...new Set(names)];
  } catch {
    return [];
  }
}

export async function listConnectedAccountApps(apiKey: string, entityId: string): Promise<string[]> {
  try {
    const items = await fetchConnectedAccountItems(apiKey, entityId);
    return appNamesOf(items);
  } catch (e: unknown) {
    throw toStatusError(e, "composio verify failed");
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
  apiKey: string,
  entityId: string,
  channel: Exclude<Channel, "email">,
): Promise<{ id: string; appName: string } | null> {
  try {
    const matcher = CHANNEL_APP_MATCHERS[channel];
    const items = await fetchConnectedAccountItems(apiKey, entityId);
    for (const c of items) {
      try {
        const rec = c as { appName?: unknown; appUniqueId?: unknown; status?: unknown; id?: unknown; connectedAccountId?: unknown } | null | undefined;
        const appName = String(rec?.appName ?? rec?.appUniqueId ?? "").trim();
        if (!appName || !matcher.test(appName)) continue;
        const status = String(rec?.status ?? "ACTIVE").toUpperCase();
        if (status && status !== "ACTIVE" && status !== "ENABLED") continue;
        const id = String(rec?.id ?? rec?.connectedAccountId ?? "").trim();
        if (id) return { id, appName };
      } catch {
        // skip bad row
      }
    }
    return null;
  } catch (e: unknown) {
    // Propagate auth/config errors so dispatch can map them; connection-list
    // failures otherwise mean "no usable account".
    if (e instanceof MissingComposioConfigError) throw e;
    const st = statusOf(e);
    const msg = messageOf(e, "composio verify failed");
    if (isNotConnectedOrAuth(msg, st)) throw toStatusError(e, msg, st ?? 502);
    if (st === 401 || st === 403) throw toStatusError(e, msg, st);
    return null;
  }
}

async function resolveActionSlug(
  apiKey: string,
  appName: string,
  channel: Exclude<Channel, "email">,
): Promise<string> {
  const fallback = FALLBACK_ACTIONS[channel][0];
  try {
    const key = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!key) return fallback;
    const app = typeof appName === "string" ? appName.trim().toLowerCase() : "";
    if (!app) return fallback;
    let res: Response;
    try {
      res = await fetch(`${COMPOSIO_BASE}/api/v3/actions/list?app_names=${encodeURIComponent(app)}`, {
        method: "GET",
        headers: { "x-api-key": key },
        cache: "no-store",
      });
    } catch {
      return fallback;
    }
    if (!res.ok) return fallback;
    let json: Record<string, unknown>;
    try {
      json = await safeJson(res);
    } catch {
      return fallback;
    }
    let items: unknown[] = [];
    try {
      const maybe = (json as { items?: unknown })?.items ?? (json as { data?: { items?: unknown } })?.data?.items ?? [];
      if (Array.isArray(maybe)) items = maybe;
    } catch {
      return fallback;
    }
    let names: string[] = [];
    try {
      names = items
        .map((a) => {
          try {
            return String((a as { name?: unknown; slug?: unknown })?.name ?? (a as { slug?: unknown })?.slug ?? "");
          } catch {
            return "";
          }
        })
        .filter((n) => Boolean(n));
    } catch {
      return fallback;
    }
    const want =
      channel === "whatsapp"
        ? [/whatsapp.*send.*message/i, /send.*message/i]
        : channel === "sms"
          ? [/send.*sms/i, /send.*message/i, /send.*text/i]
          : [/make.*call/i, /create.*call/i, /initiate.*call/i, /outbound.*call/i];
    for (const re of want) {
      try {
        const hit = names.find((n) => re.test(n));
        if (hit) return hit;
      } catch {
        // try next pattern
      }
    }
    if (names.length > 0 && channel === "whatsapp") {
      try {
        return names[0];
      } catch {
        return fallback;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export type DispatchInput = {
  subject: string;
  body: string;
  to?: string;
  recipientEmail?: string;
};

function buildChannelText(input: DispatchInput): string {
  try {
    const subject = typeof input?.subject === "string" ? input.subject : "";
    const body = typeof input?.body === "string" ? input.body : "";
    return subject ? `${subject}\n\n${body}` : body;
  } catch {
    return "";
  }
}

export async function dispatchViaComposio(opts: {
  apiKey: string;
  entityId: string;
  channel: Exclude<Channel, "email">;
  input: DispatchInput;
}): Promise<{ actionName: string; appName: string; data: unknown }> {
  try {
    const key = typeof opts?.apiKey === "string" ? opts.apiKey.trim() : "";
    if (!key) throw new MissingComposioConfigError();
    const entityId = typeof opts?.entityId === "string" && opts.entityId.trim() ? opts.entityId.trim() : "default";
    const channel = opts?.channel;
    if (channel !== "whatsapp" && channel !== "sms" && channel !== "voice") {
      throw new ChannelNotConnectedError(channel as Channel);
    }
    let account: { id: string; appName: string } | null;
    try {
      account = await findConnectedAccountForChannel(key, entityId, channel);
    } catch (e: unknown) {
      throw toStatusError(e, "composio dispatch failed");
    }
    if (!account) throw new ChannelNotConnectedError(channel);
    const actionName = await resolveActionSlug(key, account.appName, channel);
    const text = buildChannelText(opts.input);
    let to = "";
    try {
      to = String(opts.input?.to ?? opts.input?.recipientEmail ?? "").trim();
    } catch {
      to = "";
    }
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
    if (channel === "voice") {
      input.script = text;
      input.message_body = text;
    }
    let res: Response;
    try {
      res = await fetch(`${COMPOSIO_BASE}/api/v3/actions/${encodeURIComponent(actionName)}/execute`, {
        method: "POST",
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ connected_account_id: account.id, entity_id: entityId, input }),
      });
    } catch {
      throw Object.assign(new Error("composio unreachable"), { status: 502 });
    }
    let json: Record<string, unknown> = {};
    try {
      json = await safeJson(res);
    } catch {
      json = {};
    }
    if (!res.ok) {
      const msg = providerMessage(json, `action ${actionName} failed`);
      const full = msg.includes(String(res.status)) ? msg : `composio action failed (status ${res.status}): ${msg}`;
      if (isNotConnectedOrAuth(msg, res.status)) throw new ChannelNotConnectedError(channel);
      throw Object.assign(new Error(full.slice(0, 1000)), { status: res.status });
    }
    try {
      const successful = (json as { successful?: unknown })?.successful;
      if (successful === false) {
        const msg = providerMessage(json, `action ${actionName} failed`);
        if (isNotConnectedOrAuth(msg)) throw new ChannelNotConnectedError(channel);
        throw Object.assign(new Error(msg.slice(0, 1000)), { status: 502 });
      }
    } catch (e: unknown) {
      if (e instanceof ChannelNotConnectedError) throw e;
      // If the check itself crashed, treat as provider failure, never TypeError.
      throw toStatusError(e, `action ${actionName} failed`);
    }
    let data: unknown = json;
    try {
      const j = json as { data?: unknown; result?: unknown };
      data = j?.data ?? j?.result ?? json;
    } catch {
      data = json;
    }
    return { actionName, appName: account.appName, data };
  } catch (e: unknown) {
    if (e instanceof ChannelNotConnectedError) throw e;
    if (e instanceof MissingComposioConfigError) throw e;
    const msg = messageOf(e, "composio dispatch failed");
    if (isNotConnectedOrAuth(msg, statusOf(e))) {
      try {
        const ch = (opts as { channel?: unknown })?.channel;
        if (ch === "whatsapp" || ch === "sms" || ch === "voice") throw new ChannelNotConnectedError(ch);
      } catch (inner: unknown) {
        if (inner instanceof ChannelNotConnectedError) throw inner;
      }
    }
    throw toStatusError(e, msg || "composio dispatch failed");
  }
}
