// Infrastructure — Composio → OneSignal dispatch (SERVER ONLY).
// Never import this module from client components. The API key is resolved
// per-owner from Convex settings with process.env.COMPOSIO_API_KEY fallback.
// Missing keys throw so route handlers can respond 503. Nothing here runs at
// build time (direct fetch only — no composio-core SDK, so auth/entity error
// responses can never surface as raw TypeErrors).
//
// Toolkit: ONESIGNAL_REST_API (Composio slug `onesignal_rest_api`, API_KEY auth).
// Sends go through ONESIGNAL_REST_API_CREATE_NOTIFICATION, so no OneSignal key
// is ever stored in this app — the connected account holds it in Composio.

export type Channel = "email" | "sms" | "push";

export const CHANNELS: Channel[] = ["email", "sms", "push"];

export const ONESIGNAL_TOOLKIT_SLUG = "onesignal_rest_api";
export const ONESIGNAL_TOOLKIT_NAME = "ONESIGNAL_REST_API";
export const ONESIGNAL_CREATE_NOTIFICATION_TOOL = "ONESIGNAL_REST_API_CREATE_NOTIFICATION";
export const ONESIGNAL_VIEW_AN_APP_TOOL = "ONESIGNAL_REST_API_VIEW_AN_APP";

export class MissingComposioConfigError extends Error {
  readonly status = 503;
  constructor(message = "Composio not configured — save your Composio API key in /connect") {
    super(message);
    this.name = "MissingComposioConfigError";
  }
}

export class ChannelNotConnectedError extends Error {
  readonly status = 502;
  constructor(channel: Channel | string) {
    super(`${channel} channel not connected — connect OneSignal in /connect`);
    this.name = "ChannelNotConnectedError";
  }
}

export class MissingOneSignalAppIdError extends Error {
  readonly status = 503;
  constructor(message = "OneSignal App ID not set — add it in /connect") {
    super(message);
    this.name = "MissingOneSignalAppIdError";
  }
}

export class OneSignalAuthError extends Error {
  readonly status = 502;
  constructor(
    message = "OneSignal rejected the key stored in the connected Composio account — reconnect OneSignal in /connect with your OneSignal REST API key (not the App ID)",
  ) {
    super(message);
    this.name = "OneSignalAuthError";
  }
}

const COMPOSIO_BASES = [
  "https://backend.composio.dev/api/v3.1",
  "https://backend.composio.dev/api/v3",
];

// ---------- Credential resolution ----------

export function resolveComposioKey(settingsKey?: string | null): string {
  const fromSettings = typeof settingsKey === "string" ? settingsKey.trim() : "";
  if (fromSettings) return fromSettings;
  const fromEnv = process.env.COMPOSIO_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  throw new MissingComposioConfigError();
}

// ---------- TypeError-proof helpers ----------

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
  if (typeof value === "string") return (value.trim() || fallback).slice(0, 1000);
  if (value === null || value === undefined) return fallback;
  try {
    const maybeMsg = (value as { message?: unknown })?.message;
    if (typeof maybeMsg === "string" && maybeMsg.trim()) return maybeMsg.trim().slice(0, 1000);
  } catch {
    // ignore
  }
  return fallback;
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
  const msg = messageOf(value, fallbackMsg);
  const err = new Error(msg) as Error & { status?: number };
  err.status = statusOf(value) ?? fallbackStatus;
  return err;
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
      // Composio execute errors: { error: { message, code, suggested_fix } }.
      if (v && typeof v === "object") {
        const inner = providerMessage(v as Record<string, unknown>, "");
        if (inner) return inner;
      }
      if (Array.isArray(v)) {
        const first = v
          .map((x) => (typeof x === "string" ? x : (x as { message?: unknown })?.message))
          .find((x) => typeof x === "string" && (x as string).trim());
        if (typeof first === "string" && first.trim()) return first.trim().slice(0, 1000);
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
      (json as { connectedAccounts?: unknown })?.connectedAccounts ??
      [];
    if (Array.isArray(maybeItems)) return maybeItems;
    if (Array.isArray(json as unknown as unknown[])) return json as unknown as unknown[];
    return [];
  } catch {
    return [];
  }
}

function strField(rec: unknown, keys: string[]): string {
  try {
    const r = rec as Record<string, unknown> | null | undefined;
    if (!r || typeof r !== "object") return "";
    for (const k of keys) {
      const v = r[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    return "";
  } catch {
    return "";
  }
}

export function resolveEntityId(settingsUser?: string | null, override?: string | null): string {
  const o = typeof override === "string" ? override.trim() : "";
  if (o) return o;
  const s = typeof settingsUser === "string" ? settingsUser.trim() : "";
  return s || "default";
}

function toolkitSlugOf(rec: unknown): string {
  try {
    const r = rec as { toolkit?: unknown } | null | undefined;
    const tk = r?.toolkit;
    if (typeof tk === "string" && tk.trim()) return tk.trim();
    if (tk && typeof tk === "object") {
      const slug = (tk as { slug?: unknown })?.slug;
      if (typeof slug === "string" && slug.trim()) return slug.trim();
    }
    return strField(rec, ["toolkit_slug", "toolkitSlug", "appUniqueId", "app_unique_id", "appName", "alias", "slug"]);
  } catch {
    return "";
  }
}

function isOneSignalToolkit(rec: unknown): boolean {
  const slug = toolkitSlugOf(rec).toLowerCase().replace(/[\s-]+/g, "_");
  return slug.includes("onesignal");
}

function accountStatusOf(rec: unknown): string {
  const s = strField(rec, ["status", "state"]);
  return s ? s.toUpperCase() : "UNKNOWN";
}

function entityOf(rec: unknown): string {
  return strField(rec, ["user_id", "userId", "entity_id", "entityId"]);
}

export function isUsableConnectedAccountStatus(status: string): boolean {
  if (!status) return true;
  return (
    status === "ACTIVE" ||
    status === "ENABLED" ||
    status === "CONNECTED" ||
    status === "SUCCESS" ||
    status === "UNKNOWN"
  );
}

// ---------- Connected accounts ----------

export type OneSignalConnection = { id: string; toolkit: string; status: string };

async function fetchConnectedAccountItems(
  apiKey: string,
  entityId: string,
): Promise<unknown[]> {
  const key = apiKey.trim();
  if (!key) throw new MissingComposioConfigError();
  const eid = entityId.trim() || "default";
  const headers = { "x-api-key": key };
  let lastError: (Error & { status?: number }) | null = null;

  for (let bi = 0; bi < COMPOSIO_BASES.length; bi++) {
    const base = COMPOSIO_BASES[bi];
    const isLast = bi === COMPOSIO_BASES.length - 1;
    for (const query of [`?user_ids=${encodeURIComponent(eid)}`, ""]) {
      let res: Response;
      try {
        res = await fetch(`${base}/connected_accounts${query}`, { method: "GET", headers, cache: "no-store" });
      } catch {
        lastError = Object.assign(new Error("composio unreachable"), { status: 502 });
        break;
      }
      if (res.status === 404) break; // try the next API base
      let json: Record<string, unknown> = {};
      try {
        json = await safeJson(res);
      } catch {
        json = {};
      }
      if (!res.ok) {
        const msg = providerMessage(json, `composio connected accounts failed (status ${res.status})`);
        const full = msg.includes(String(res.status))
          ? msg
          : `composio connected accounts failed (status ${res.status}): ${msg}`;
        lastError = Object.assign(new Error(full.slice(0, 1000)), { status: res.status });
        if (res.status === 401 || res.status === 403) throw lastError;
        break;
      }
      // Filtered call can come back empty on some bases — the second pass
      // (query === "") lists everything and we match the entity client-side.
      const items = extractItems(json).filter((it) => {
        const uid = entityOf(it);
        return !uid || uid === eid;
      });
      if (items.length > 0) return items;
      if (!query) return items;
    }
    if (isLast && lastError && (lastError as { status?: number }).status === 502) continue;
  }
  if (lastError) throw lastError;
  return [];
}

export async function listOneSignalConnections(
  apiKey: string,
  entityId: string,
): Promise<OneSignalConnection[]> {
  try {
    const items = await fetchConnectedAccountItems(apiKey, entityId);
    const out: OneSignalConnection[] = [];
    for (const c of items) {
      if (!isOneSignalToolkit(c)) continue;
      const id = strField(c, ["id", "connected_account_id", "connectedAccountId"]);
      if (!id) continue;
      out.push({ id, toolkit: toolkitSlugOf(c) || ONESIGNAL_TOOLKIT_NAME, status: accountStatusOf(c) });
    }
    return out;
  } catch (e: unknown) {
    throw toStatusError(e, "composio verify failed");
  }
}

// ---------- Connected-account health probe ----------
// Composio status "ACTIVE" only means the auth flow completed — it does NOT
// mean the stored OneSignal key is valid (users paste the App ID instead of
// the REST API key there, and OneSignal then answers every call with 401).
// A cheap VIEW_AN_APP probe distinguishes a genuinely usable account from a
// broken one, so sends can fail over to another connection instead of dying.

export type OneSignalProbe = { ok: boolean; message: string };

export async function probeOneSignalAccount(
  apiKey: string,
  accountId: string,
  entityId: string,
  appId: string,
): Promise<OneSignalProbe> {
  const key = apiKey.trim();
  if (!key) throw new MissingComposioConfigError();
  const { res, json } = await postComposio(
    key,
    `/tools/execute/${encodeURIComponent(ONESIGNAL_VIEW_AN_APP_TOOL)}`,
    {
      connected_account_id: accountId,
      user_id: entityId.trim() || "default",
      arguments: { app_id: appId.trim() || "00000000-0000-0000-0000-000000000000" },
    },
  );
  const msg = providerMessage(json, `probe failed (status ${res.status})`);
  if (!res.ok) return { ok: false, message: msg };
  if ((json as { successful?: unknown })?.successful === false) return { ok: false, message: msg };
  return { ok: true, message: "" };
}

// Picks the first ACTIVE OneSignal connection that can actually talk to
// OneSignal. Returns the first ACTIVE account when probing is impossible
// (e.g. no App ID saved yet) and null when every ACTIVE account is broken.
export async function pickWorkingOneSignalAccount(opts: {
  apiKey: string;
  entityId: string;
  appId?: string;
}): Promise<{ accountId: string; probed: boolean } | null> {
  const key = opts.apiKey.trim();
  if (!key) throw new MissingComposioConfigError();
  const accounts = await listOneSignalConnections(key, opts.entityId);
  const active = accounts.filter((a) => isUsableConnectedAccountStatus(a.status));
  if (active.length === 0) return null;
  const appId = (opts.appId ?? "").trim();
  if (!appId) return { accountId: active[0].id, probed: false };
  for (const account of active) {
    try {
      const probe = await probeOneSignalAccount(key, account.id, opts.entityId, appId);
      if (probe.ok) return { accountId: account.id, probed: true };
    } catch {
      // A probe transport error must not hide the remaining candidates.
    }
  }
  return null;
}

// ---------- One-click authorization: auth config + connect link ----------

export type AuthConfig = { id: string; isComposioManaged: boolean; toolkit: string };

function authConfigIdOf(rec: unknown): string {
  return strField(rec, ["id", "auth_config_id", "authConfigId"]);
}

function authConfigManagedOf(rec: unknown): boolean {
  try {
    const r = rec as Record<string, unknown> | null | undefined;
    const candidates = [r?.["is_composio_managed"], r?.["isComposioManaged"]];
    for (const c of candidates) {
      if (c === true) return true;
      if (typeof c === "string" && c.trim().toLowerCase() === "true") return true;
      if (typeof c === "number" && c === 1) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function listAuthConfigs(apiKey: string, toolkitSlug: string): Promise<AuthConfig[]> {
  const key = apiKey.trim();
  if (!key) throw new MissingComposioConfigError();
  const slug = toolkitSlug.trim();
  if (!slug) return [];
  let lastError: (Error & { status?: number }) | null = null;
  for (const base of COMPOSIO_BASES) {
    for (const param of ["toolkit_slug", "toolkit_slugs"]) {
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
      const out: AuthConfig[] = [];
      for (const it of extractItems(json)) {
        const id = authConfigIdOf(it);
        if (!id) continue;
        out.push({ id, isComposioManaged: authConfigManagedOf(it), toolkit: toolkitSlugOf(it) });
      }
      return out;
    }
  }
  if (lastError) throw lastError;
  return [];
}

// Creates the OneSignal auth config when the project has none yet, so the
// owner never has to leave /connect to click through the dashboard.
// Verified against the live API: POST /auth_configs with a nested
// auth_config{type: use_custom_auth, authScheme: API_KEY} (no credentials —
// the owner supplies the OneSignal key in the hosted Composio connect flow).
async function createAuthConfig(apiKey: string, toolkitSlug: string): Promise<string> {
  const key = apiKey.trim();
  const body = JSON.stringify({
    toolkit: { slug: toolkitSlug },
    name: "OneSignal (ClearDue)",
    auth_config: { type: "use_custom_auth", authScheme: "API_KEY" },
  });
  let lastError: (Error & { status?: number }) | null = null;
  for (let bi = 0; bi < COMPOSIO_BASES.length; bi++) {
    const base = COMPOSIO_BASES[bi];
    const isLast = bi === COMPOSIO_BASES.length - 1;
    let res: Response;
    try {
      res = await fetch(`${base}/auth_configs`, {
        method: "POST",
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        body,
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
      const msg = providerMessage(json, `composio auth config create failed (status ${res.status})`);
      lastError = Object.assign(new Error(msg.slice(0, 1000)), { status: res.status });
      break;
    }
    const inner = (json as { auth_config?: unknown })?.auth_config ?? json;
    const id = authConfigIdOf(inner);
    if (id) return id;
    throw Object.assign(new Error("composio auth config create returned no id"), { status: 502 });
  }
  throw (lastError ?? Object.assign(new Error("composio auth config create failed"), { status: 502 }));
}

// Resolves the auth config used for OneSignal connect links: the project's
// existing one (Composio-managed preferred) or a freshly created one.
export async function ensureOneSignalAuthConfig(apiKey: string): Promise<AuthConfig> {
  const existing = await listAuthConfigs(apiKey, ONESIGNAL_TOOLKIT_SLUG);
  if (existing.length > 0) {
    const picked = existing.find((c) => c.isComposioManaged) ?? existing[0];
    return picked;
  }
  const id = await createAuthConfig(apiKey, ONESIGNAL_TOOLKIT_SLUG);
  return { id, isComposioManaged: false, toolkit: ONESIGNAL_TOOLKIT_NAME };
}

function redirectUrlOf(json: Record<string, unknown>): string {
  try {
    const candidates: unknown[] = [
      (json as { redirect_url?: unknown })?.redirect_url,
      (json as { redirectUrl?: unknown })?.redirectUrl,
    ];
    const data = (json as { data?: unknown })?.data as Record<string, unknown> | undefined;
    if (data && typeof data === "object") {
      candidates.push(data.redirect_url, data.redirectUrl);
    }
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
    return "";
  } catch {
    return "";
  }
}

async function postComposio(
  apiKey: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<{ res: Response; json: Record<string, unknown> }> {
  const headers = { "x-api-key": apiKey.trim(), "Content-Type": "application/json" };
  for (let bi = 0; bi < COMPOSIO_BASES.length; bi++) {
    const base = COMPOSIO_BASES[bi];
    const isLast = bi === COMPOSIO_BASES.length - 1;
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(payload) });
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
    return { res, json };
  }
  throw Object.assign(new Error("composio unreachable"), { status: 502 });
}

// One-click authorize: returns the hosted Composio URL where the owner signs
// into OneSignal / pastes their OneSignal REST API key. The secret then lives
// in the Composio connected account — never in ClearDue.
export async function createOneSignalConnectLink(
  apiKey: string,
  opts: { authConfigId: string; entityId: string },
): Promise<string> {
  const authConfigId = opts.authConfigId.trim();
  const userId = opts.entityId.trim() || "default";
  if (!authConfigId) throw Object.assign(new Error("auth_config_id required"), { status: 400 });

  // `link` is the current endpoint; API-key auth configs on older projects
  // only answer `POST /connected_accounts`. Try both.
  const { res, json } = await postComposio(apiKey, "/connected_accounts/link", {
    auth_config_id: authConfigId,
    user_id: userId,
  });
  if (res.ok) {
    const url = redirectUrlOf(json);
    if (url) return url;
    throw Object.assign(new Error("composio connect link missing redirect_url"), { status: 502 });
  }
  const linkMsg = providerMessage(json, `composio connect link failed (status ${res.status})`);

  const fallback = await postComposio(apiKey, "/connected_accounts", {
    auth_config_id: authConfigId,
    user_id: userId,
  });
  if (fallback.res.ok) {
    const url = redirectUrlOf(fallback.json);
    if (url) return url;
  }
  const fallbackMsg = fallback.res.ok
    ? "composio connect link missing redirect_url"
    : providerMessage(fallback.json, linkMsg);
  throw Object.assign(new Error(fallbackMsg.slice(0, 1000)), {
    status: fallback.res.ok ? 502 : fallback.res.status,
  });
}


// ---------- Dispatch: OneSignal notification via Composio ----------

function extractOneSignalId(data: unknown): string {
  const fromRecord = (rec: unknown): string => strField(rec, ["id", "notification_id", "notificationId"]);
  try {
    if (typeof data === "string") {
      const text = data.trim();
      if (!text) return "";
      try {
        return extractOneSignalId(JSON.parse(text));
      } catch {
        return "";
      }
    }
    if (!data || typeof data !== "object") return "";
    const direct = fromRecord(data);
    if (direct) return direct;
    const rec = data as Record<string, unknown>;
    for (const key of ["data", "result", "response", "notification"]) {
      const inner = rec[key];
      const found = fromRecord(inner);
      if (found) return found;
      if (typeof inner === "string") {
        const nested = extractOneSignalId(inner);
        if (nested) return nested;
      }
    }
    return "";
  } catch {
    return "";
  }
}

function buildNotificationArguments(opts: {
  appId: string;
  channel: Channel;
  to: string;
  subject: string;
  body: string;
}): Record<string, unknown> {
  // Declared tool params stay top-level (app_id / contents / headings); the
  // channel-specific targeting params ride in `extra_params`, which the
  // ONESIGNAL_REST_API_CREATE_NOTIFICATION tool forwards verbatim.
  const extra: Record<string, unknown> = {};
  if (opts.channel === "email") {
    extra.include_email_tokens = [opts.to];
    extra.email_subject = opts.subject;
    extra.email_body = opts.body;
  } else if (opts.channel === "sms") {
    extra.include_phone_numbers = [opts.to];
    const from = process.env.ONESIGNAL_SMS_FROM?.trim();
    if (from) extra.sms_from = from;
  } else {
    extra.include_external_user_ids = [opts.to];
  }
  return {
    app_id: opts.appId,
    headings: { en: opts.subject },
    contents: { en: opts.body },
    extra_params: extra,
  };
}

function looksUnconnected(msg: string): boolean {
  return /not (found|connected|enabled)|no .*account/i.test(msg);
}

function looksAuthRejected(msg: string): boolean {
  return /unauthorized|forbidden|invalid[\s_-]*(api[\s_-]*)?key|missing or invalid authorization|access denied|auth/i.test(
    msg,
  );
}
export async function dispatchViaComposioOneSignal(opts: {
  apiKey: string;
  entityId: string;
  appId: string;
  channel: Channel;
  to: string;
  subject: string;
  body: string;
  connectedAccountId?: string | null;
}): Promise<{ id: string; action: string; accountId: string }> {
  try {
    const key = typeof opts?.apiKey === "string" ? opts.apiKey.trim() : "";
    if (!key) throw new MissingComposioConfigError();
    const appId = typeof opts?.appId === "string" ? opts.appId.trim() : "";
    if (!appId) throw new MissingOneSignalAppIdError();
    const entityId = resolveEntityId(opts?.entityId);
    const channel = opts?.channel;
    if (channel !== "email" && channel !== "sms" && channel !== "push") {
      throw new ChannelNotConnectedError(String(channel));
    }

    let accountId = typeof opts?.connectedAccountId === "string" ? opts.connectedAccountId.trim() : "";
    if (!accountId) {
      // Prefer an ACTIVE connection whose stored OneSignal key actually works;
      // a broken-but-ACTIVE account (e.g. App ID pasted as the key) must not
      // block a send when another ACTIVE connection is healthy.
      const picked = await pickWorkingOneSignalAccount({ apiKey: key, entityId, appId });
      if (!picked) throw new ChannelNotConnectedError(channel);
      accountId = picked.accountId;
    }

    const args = buildNotificationArguments({
      appId,
      channel,
      to: opts.to,
      subject: opts.subject,
      body: opts.body,
    });
    const { res, json } = await postComposio(
      key,
      `/tools/execute/${encodeURIComponent(ONESIGNAL_CREATE_NOTIFICATION_TOOL)}`,
      { connected_account_id: accountId, user_id: entityId, arguments: args },
    );

    if (!res.ok) {
      const msg = providerMessage(json, `composio OneSignal send failed (status ${res.status})`);
      if (looksUnconnected(msg)) throw new ChannelNotConnectedError(channel);
      if (looksAuthRejected(msg)) throw new OneSignalAuthError(msg.slice(0, 1000));
      const full = msg.includes(String(res.status))
        ? msg
        : `composio OneSignal send failed (status ${res.status}): ${msg}`;
      throw Object.assign(new Error(full.slice(0, 1000)), { status: res.status });
    }
    if ((json as { successful?: unknown })?.successful === false) {
      const msg = providerMessage(json, "composio OneSignal send failed");
      if (looksUnconnected(msg)) throw new ChannelNotConnectedError(channel);
      if (looksAuthRejected(msg)) throw new OneSignalAuthError(msg.slice(0, 1000));
      throw Object.assign(new Error(msg.slice(0, 1000)), { status: 502 });
    }

    const data = (json as { data?: unknown })?.data ?? (json as { result?: unknown })?.result ?? json;
    return {
      id: extractOneSignalId(data) || "unknown",
      action: ONESIGNAL_CREATE_NOTIFICATION_TOOL,
      accountId,
    };
  } catch (e: unknown) {
    if (
      e instanceof ChannelNotConnectedError ||
      e instanceof MissingComposioConfigError ||
      e instanceof MissingOneSignalAppIdError ||
      e instanceof OneSignalAuthError
    ) {
      throw e;
    }
    throw toStatusError(e, "composio OneSignal send failed");
  }
}

