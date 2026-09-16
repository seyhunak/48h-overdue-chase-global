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

const COMPOSIO_BASES = [
  "https://backend.composio.dev/api/v3.1",
  "https://backend.composio.dev/api/v3",
];

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

function extractItems(json: Record<string, unknown>): unknown[] {
  try {
    const maybeItems: unknown =
      (json as { items?: unknown })?.items ??
      (json as { data?: { items?: unknown } })?.data?.items ??
      (json as { tools?: unknown })?.tools ??
      (json as { connectedAccounts?: unknown })?.connectedAccounts ??
      [];
    if (Array.isArray(maybeItems)) return maybeItems;
    if (Array.isArray(json as unknown as unknown[])) return json as unknown as unknown[];
    return [];
  } catch {
    return [];
  }
}

function toolkitDisplayNameOf(rec: unknown): string {
  try {
    const r = rec as {
      toolkit?: unknown;
      toolkitSlug?: unknown;
      appName?: unknown;
      appUniqueId?: unknown;
      app_unique_id?: unknown;
      alias?: unknown;
    } | null | undefined;
    if (!r || typeof r !== "object") return "";
    const tk = r.toolkit;
    if (typeof tk === "string" && tk.trim()) return tk.trim();
    if (tk && typeof tk === "object") {
      try {
        const slug = (tk as { slug?: unknown })?.slug;
        if (typeof slug === "string" && slug.trim()) return slug.trim();
      } catch {
        // ignore
      }
    }
    const candidates = [r.toolkitSlug, r.appName, r.appUniqueId, r.app_unique_id, r.alias];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
    return "";
  } catch {
    return "";
  }
}

export type ConnectedAccount = { id: string; app: string; status: string };

function accountStatusOf(rec: unknown): string {
  try {
    const r = rec as { status?: unknown; state?: unknown } | null | undefined;
    const candidates = [r?.status, r?.state];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim().toUpperCase();
    }
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
function accountIdOf(rec: unknown): string {
  try {
    const r = rec as {
      id?: unknown;
      connected_account_id?: unknown;
      connectedAccountId?: unknown;
    } | null | undefined;
    const candidates = [r?.id, r?.connected_account_id, r?.connectedAccountId];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
      if (typeof c === "number" && Number.isFinite(c)) return String(c);
    }
    return "";
  } catch {
    return "";
  }
}

function accountUserIdOf(rec: unknown): string {
  try {
    const r = rec as {
      user_id?: unknown;
      userId?: unknown;
      entity_id?: unknown;
      entityId?: unknown;
    } | null | undefined;
    const candidates = [r?.user_id, r?.userId, r?.entity_id, r?.entityId];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
    return "";
  } catch {
    return "";
  }
}

async function fetchConnectedAccountItems(apiKey: string, entityId: string): Promise<unknown[]> {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) throw new MissingComposioConfigError();
  const eid = typeof entityId === "string" && entityId.trim() ? entityId.trim() : "default";
  let lastError: (Error & { status?: number }) | null = null;

  async function getJson(url: string): Promise<{ res: Response; json: Record<string, unknown> }> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: { "x-api-key": key },
        cache: "no-store",
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
    return { res, json };
  }

  function filterByEntity(items: unknown[]): unknown[] {
    try {
      const filtered = items.filter((it) => {
        try {
          const uid = accountUserIdOf(it);
          if (!uid) return true;
          return uid === eid;
        } catch {
          return true;
        }
      });
      const hasUid = items.some((it) => {
        try {
          return Boolean(accountUserIdOf(it));
        } catch {
          return false;
        }
      });
      if (!hasUid) return items;
      return filtered;
    } catch {
      return items;
    }
  }

  for (const base of COMPOSIO_BASES) {
    // 1) Filtered list: GET {base}/connected_accounts?user_ids=<entityId>
    let filtered: { res: Response; json: Record<string, unknown> };
    try {
      filtered = await getJson(`${base}/connected_accounts?user_ids=${encodeURIComponent(eid)}`);
    } catch (e: unknown) {
      lastError = toStatusError(e, "composio unreachable", 502);
      continue;
    }
    if (filtered.res.ok) {
      const items = extractItems(filtered.json);
      if (items.length > 0) return items;
      // Filtered call emptied — retry unfiltered on the same base,
      // then filter client-side by item.user_id.
      try {
        const unfiltered = await getJson(`${base}/connected_accounts`);
        if (unfiltered.res.status === 404) {
          lastError = Object.assign(
            new Error(`composio verify failed (status 404): ${providerMessage(unfiltered.json, "not found")}`.slice(0, 1000)),
            { status: 404 },
          );
          continue;
        }
        if (!unfiltered.res.ok) {
          const msg = providerMessage(unfiltered.json, `composio verify failed (status ${unfiltered.res.status})`);
          const full = msg.includes(String(unfiltered.res.status))
            ? msg
            : `composio verify failed (status ${unfiltered.res.status}): ${msg}`;
          lastError = Object.assign(new Error(full.slice(0, 1000)), { status: unfiltered.res.status });
          if (unfiltered.res.status === 401 || unfiltered.res.status === 403) throw lastError;
          continue;
        }
        const all = extractItems(unfiltered.json);
        const kept = filterByEntity(all);
        if (kept.length > 0) return kept;
        if (all.length > 0) return all;
        lastError = null;
        continue;
      } catch (e: unknown) {
        if (e instanceof MissingComposioConfigError) throw e;
        const st = statusOf(e);
        if (st === 401 || st === 403) throw toStatusError(e, messageOf(e, "composio verify failed"), st);
        if (e instanceof Error && (e as { status?: unknown }).status !== undefined) {
          lastError = e as Error & { status?: number };
        }
        continue;
      }
    }
    if (filtered.res.status === 404 || filtered.res.status === 400 || filtered.res.status === 422) {
      // Filter param unsupported on this version — retry unfiltered on the
      // same base and filter client-side by item.user_id.
      try {
        const unfiltered = await getJson(`${base}/connected_accounts`);
        if (unfiltered.res.status === 404) {
          lastError = Object.assign(
            new Error(`composio verify failed (status 404): ${providerMessage(unfiltered.json, "not found")}`.slice(0, 1000)),
            { status: 404 },
          );
          continue;
        }
        if (!unfiltered.res.ok) {
          const msg = providerMessage(unfiltered.json, `composio verify failed (status ${unfiltered.res.status})`);
          const full = msg.includes(String(unfiltered.res.status))
            ? msg
            : `composio verify failed (status ${unfiltered.res.status}): ${msg}`;
          lastError = Object.assign(new Error(full.slice(0, 1000)), { status: unfiltered.res.status });
          if (unfiltered.res.status === 401 || unfiltered.res.status === 403) throw lastError;
          continue;
        }
        const all = extractItems(unfiltered.json);
        const kept = filterByEntity(all);
        if (kept.length > 0) return kept;
        if (all.length > 0) return all;
        lastError = null;
        continue;
      } catch (e: unknown) {
        if (e instanceof MissingComposioConfigError) throw e;
        const st = statusOf(e);
        if (st === 401 || st === 403) throw toStatusError(e, messageOf(e, "composio verify failed"), st);
        if (e instanceof Error && (e as { status?: unknown }).status !== undefined) {
          lastError = e as Error & { status?: number };
        }
        continue;
      }
    }
    // Non-404 failure: surface auth errors immediately; otherwise fall
    // through to the next base version before giving up.
    try {
      const msg = providerMessage(filtered.json, `composio verify failed (status ${filtered.res.status})`);
      const full = msg.includes(String(filtered.res.status))
        ? msg
        : `composio verify failed (status ${filtered.res.status}): ${msg}`;
      lastError = Object.assign(new Error(full.slice(0, 1000)), { status: filtered.res.status });
      if (filtered.res.status === 401 || filtered.res.status === 403) throw lastError;
      continue;
    } catch (e: unknown) {
      if (e instanceof MissingComposioConfigError) throw e;
      const st = statusOf(e);
      if (st === 401 || st === 403) throw toStatusError(e, messageOf(e, "composio verify failed"), st);
      if (e instanceof Error && (e as { status?: unknown }).status !== undefined) {
        lastError = e as Error & { status?: number };
      }
      continue;
    }
  }
  if (lastError) throw lastError;
  return [];
}

function appNamesOf(items: unknown[]): string[] {
  try {
    const names: string[] = [];
    for (const c of items) {
      try {
        const n = toolkitDisplayNameOf(c);
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

export async function listConnectedAccounts(
  apiKey: string,
  entityId: string,
): Promise<ConnectedAccount[]> {
  try {
    const items = await fetchConnectedAccountItems(apiKey, entityId);
    const out: ConnectedAccount[] = [];
    for (const c of items) {
      try {
        const id = accountIdOf(c);
        const app = toolkitDisplayNameOf(c);
        if (!id || !app) continue;
        out.push({ id, app, status: accountStatusOf(c) });
      } catch {
        // skip bad row
      }
    }
    return out;
  } catch (e: unknown) {
    throw toStatusError(e, "composio verify failed");
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
  preferredAccountId?: string | null,
): Promise<{ id: string; appName: string } | null> {
  try {
    const matcher = CHANNEL_APP_MATCHERS[channel];
    const items = await fetchConnectedAccountItems(apiKey, entityId);
    const pinned = typeof preferredAccountId === "string" ? preferredAccountId.trim() : "";
    if (pinned) {
      for (const c of items) {
        try {
          const id = accountIdOf(c);
          if (!id || id !== pinned) continue;
          const appName = toolkitDisplayNameOf(c);
          if (!appName) continue;
          return { id, appName };
        } catch {
          // skip bad row
        }
      }
      // Pinned id no longer present — fall through to auto-match so a
      // stale pin degrades to "best available" instead of hard 502. The
      // caller surfaces the fallback app in the response.
    }
    for (const c of items) {
      try {
        const rec = c as { status?: unknown } | null | undefined;
        const appName = toolkitDisplayNameOf(c);
        if (!appName || !matcher.test(appName)) continue;
        const status = String(rec?.status ?? "ACTIVE").toUpperCase();
        if (status && status !== "ACTIVE" && status !== "ENABLED" && status !== "UNKNOWN") continue;
        const id = accountIdOf(c);
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
    const want =
      channel === "whatsapp"
        ? [/whatsapp.*send.*message/i, /send.*message/i]
        : channel === "sms"
          ? [/send.*sms/i, /send.*message/i, /send.*text/i]
          : [/make.*call/i, /create.*call/i, /initiate.*call/i, /outbound.*call/i];
    // Composio REST v3.1 current, v3 supported: GET {base}/tools with a
    // toolkit filter. Param naming varies — try `toolkit` first, then
    // `toolkits`. Try base versions in order (v3.1 first, v3 fallback).
    const paramKeys = ["toolkit", "toolkits"];
    for (const base of COMPOSIO_BASES) {
      for (const param of paramKeys) {
        let res: Response;
        try {
          res = await fetch(`${base}/tools?${param}=${encodeURIComponent(app)}`, {
            method: "GET",
            headers: { "x-api-key": key },
            cache: "no-store",
          });
        } catch {
          break;
        }
        if (res.status === 404) continue;
        if (!res.ok) continue;
        let json: Record<string, unknown>;
        try {
          json = await safeJson(res);
        } catch {
          continue;
        }
        const items = extractItems(json);
        let names: string[] = [];
        try {
          names = items
            .map((a) => {
              try {
                const rec = a as { name?: unknown; slug?: unknown } | null | undefined;
                const v = rec?.slug ?? rec?.name ?? "";
                return String(v ?? "").trim();
              } catch {
                return "";
              }
            })
            .filter((n) => Boolean(n));
        } catch {
          continue;
        }
        if (names.length === 0) continue;
        for (const re of want) {
          try {
            const hit = names.find((n) => re.test(n));
            if (hit) return hit;
          } catch {
            // try next pattern
          }
        }
        if (channel === "whatsapp") {
          try {
            return names[0];
          } catch {
            // fall through to fallback
          }
        }
        // Resolved a non-empty tool list but no channel-specific slug —
        // keep looking at the next param/base before using the fallback.
        if (names.length > 0 && channel !== "whatsapp") continue;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// ---------- One-click authorization: auth configs + connect links ----------

export type AuthConfig = { id: string; isComposioManaged: boolean; toolkit: string };

function authConfigIdOf(rec: unknown): string {
  try {
    const r = rec as { id?: unknown; auth_config_id?: unknown; authConfigId?: unknown } | null | undefined;
    const candidates = [r?.id, r?.auth_config_id, r?.authConfigId];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
      if (typeof c === "number" && Number.isFinite(c)) return String(c);
    }
    return "";
  } catch {
    return "";
  }
}

function authConfigManagedOf(rec: unknown): boolean {
  try {
    const r = rec as { is_composio_managed?: unknown; isComposioManaged?: unknown } | null | undefined;
    const candidates = [r?.is_composio_managed, r?.isComposioManaged];
    for (const c of candidates) {
      if (c === true) return true;
      if (c === false) return false;
      if (typeof c === "string" && c.trim().toLowerCase() === "true") return true;
      if (typeof c === "number" && c === 1) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function authConfigToolkitOf(rec: unknown): string {
  try {
    const r = rec as {
      toolkit?: unknown;
      toolkit_slug?: unknown;
      toolkitSlug?: unknown;
      slug?: unknown;
    } | null | undefined;
    if (!r || typeof r !== "object") return "";
    const tk = r.toolkit;
    if (typeof tk === "string" && tk.trim()) return tk.trim();
    if (tk && typeof tk === "object") {
      try {
        const slug = (tk as { slug?: unknown })?.slug;
        if (typeof slug === "string" && slug.trim()) return slug.trim();
      } catch {
        // ignore
      }
    }
    const candidates = [r.toolkit_slug, r.toolkitSlug, r.slug];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
    return "";
  } catch {
    return "";
  }
}

export async function listAuthConfigs(apiKey: string, toolkitSlug: string): Promise<AuthConfig[]> {
  try {
    const key = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!key) throw new MissingComposioConfigError();
    const slug = typeof toolkitSlug === "string" ? toolkitSlug.trim() : "";
    if (!slug) return [];
    let lastError: (Error & { status?: number }) | null = null;
    const paramKeys = ["toolkit_slug", "toolkit_slugs"];
    for (const base of COMPOSIO_BASES) {
      for (const param of paramKeys) {
        let res: Response;
        try {
          res = await fetch(`${base}/auth_configs?${param}=${encodeURIComponent(slug)}`, {
            method: "GET",
            headers: { "x-api-key": key },
            cache: "no-store",
          });
        } catch {
          lastError = Object.assign(new Error("composio unreachable"), { status: 502 });
          break;
        }
        if (res.status === 404) continue;
        let json: Record<string, unknown> = {};
        try {
          json = await safeJson(res);
        } catch {
          json = {};
        }
        if (!res.ok) {
          const msg = providerMessage(json, `composio auth configs failed (status ${res.status})`);
          const full = msg.includes(String(res.status))
            ? msg
            : `composio auth configs failed (status ${res.status}): ${msg}`;
          lastError = Object.assign(new Error(full.slice(0, 1000)), { status: res.status });
          if (res.status === 401 || res.status === 403) throw lastError;
          continue;
        }
        const items = extractItems(json);
        const out: AuthConfig[] = [];
        for (const it of items) {
          try {
            const id = authConfigIdOf(it);
            if (!id) continue;
            out.push({ id, isComposioManaged: authConfigManagedOf(it), toolkit: authConfigToolkitOf(it) });
          } catch {
            // skip bad row
          }
        }
        return out;
      }
    }
    if (lastError) throw lastError;
    return [];
  } catch (e: unknown) {
    throw toStatusError(e, "composio auth configs failed");
  }
}

export async function createAuthLink(
  apiKey: string,
  input: { authConfigId: string; userId: string },
): Promise<string> {
  try {
    const key = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!key) throw new MissingComposioConfigError();
    const authConfigId = typeof input?.authConfigId === "string" ? input.authConfigId.trim() : "";
    const userId = typeof input?.userId === "string" && input.userId.trim() ? input.userId.trim() : "default";
    if (!authConfigId) throw Object.assign(new Error("auth_config_id required"), { status: 400 });
    let lastError: (Error & { status?: number }) | null = null;
    for (let bi = 0; bi < COMPOSIO_BASES.length; bi++) {
      const base = COMPOSIO_BASES[bi];
      const isLast = bi === COMPOSIO_BASES.length - 1;
      let res: Response;
      try {
        res = await fetch(`${base}/connected_accounts/link`, {
          method: "POST",
          headers: { "x-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({ auth_config_id: authConfigId, user_id: userId }),
        });
      } catch {
        if (!isLast) continue;
        throw Object.assign(new Error("composio unreachable"), { status: 502 });
      }
      if (res.status === 404 && !isLast) continue;
      let json: Record<string, unknown> = {};
      try {
        json = await safeJson(res);
      } catch {
        json = {};
      }
      if (!res.ok) {
        const msg = providerMessage(json, `composio auth link failed (status ${res.status})`);
        const full = msg.includes(String(res.status))
          ? msg
          : `composio auth link failed (status ${res.status}): ${msg}`;
        lastError = Object.assign(new Error(full.slice(0, 1000)), { status: res.status });
        if (res.status === 401 || res.status === 403) throw lastError;
        if (!isLast && res.status === 404) continue;
        throw lastError;
      }
      try {
        const j = json as { redirect_url?: unknown; redirectUrl?: unknown; data?: unknown } | null | undefined;
        const candidates: unknown[] = [j?.redirect_url, j?.redirectUrl];
        try {
          const data = j?.data as { redirect_url?: unknown; redirectUrl?: unknown } | null | undefined;
          if (data && typeof data === "object") candidates.push(data.redirect_url, data.redirectUrl);
        } catch {
          // ignore
        }
        for (const c of candidates) {
          if (typeof c === "string" && c.trim()) return c.trim();
        }
      } catch {
        // fall through to error below
      }
      throw Object.assign(new Error("composio auth link missing redirect_url"), { status: 502 });
    }
    if (lastError) throw lastError;
    throw Object.assign(new Error("composio unreachable"), { status: 502 });
  } catch (e: unknown) {
    throw toStatusError(e, "composio auth link failed");
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
  preferredAccountId?: string | null;
}): Promise<{ actionName: string; appName: string; data: unknown; accountId: string }> {
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
      account = await findConnectedAccountForChannel(key, entityId, channel, opts?.preferredAccountId);
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
    let res: Response | null = null;
    let json: Record<string, unknown> = {};
    for (let bi = 0; bi < COMPOSIO_BASES.length; bi++) {
      const base = COMPOSIO_BASES[bi];
      const isLast = bi === COMPOSIO_BASES.length - 1;
      let attempt: Response;
      try {
        attempt = await fetch(`${base}/tools/execute/${encodeURIComponent(actionName)}`, {
          method: "POST",
          headers: { "x-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({ connected_account_id: account.id, user_id: entityId, arguments: input }),
        });
      } catch {
        if (!isLast) continue;
        throw Object.assign(new Error("composio unreachable"), { status: 502 });
      }
      if (attempt.status === 404 && !isLast) continue;
      res = attempt;
      try {
        json = await safeJson(res);
      } catch {
        json = {};
      }
      break;
    }
    if (!res) {
      throw Object.assign(new Error("composio unreachable"), { status: 502 });
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
    return { actionName, appName: account.appName, data, accountId: account.id };
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
