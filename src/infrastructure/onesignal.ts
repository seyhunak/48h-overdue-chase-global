// Infrastructure — OneSignal multichannel dispatch (SERVER ONLY).
// Never import this module from client components. The API keys are resolved
// per-owner from Convex settings with process.env fallback.
// Missing keys throw so route handlers can respond 503.
// Nothing here runs at build time (fetch is evaluated at request runtime).

export type Channel = "email" | "sms" | "push";

export const CHANNELS: Channel[] = ["email", "sms", "push"];

export class MissingOneSignalConfigError extends Error {
  readonly status = 503;
  constructor(message = "OneSignal not configured (missing app_id or api_key)") {
    super(message);
    this.name = "MissingOneSignalConfigError";
  }
}

export class ChannelNotConfiguredError extends Error {
  readonly status = 502;
  constructor(channel: Channel) {
    super(`${channel} channel not configured in OneSignal dashboard`);
    this.name = "ChannelNotConfiguredError";
  }
}

export class PlayerNotRegisteredError extends Error {
  readonly status = 502;
  constructor(channel: Channel) {
    super(`push player not registered for ${channel} — install OneSignal SDK in client app and register player`);
    this.name = "PlayerNotRegisteredError";
  }
}

const ONESIGNAL_BASE = "https://api.onesignal.com";

function requireOneSignalKeys(): { appId: string; apiKey: string } {
  const appId = process.env.ONESIGNAL_APP_ID?.trim();
  const apiKey = process.env.ONESIGNAL_API_KEY?.trim();
  if (!appId || !apiKey) throw new MissingOneSignalConfigError();
  return { appId, apiKey };
}

function getSmsFrom(): string | undefined {
  return process.env.ONESIGNAL_SMS_FROM?.trim();
}

async function onesignalRequest(
  path: string,
  { appId, apiKey }: { appId: string; apiKey: string },
  method: "POST" | "GET" = "POST",
  body?: Record<string, unknown>,
): Promise<Response> {
  const url = `${ONESIGNAL_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  return res;
}

async function sendEmail(opts: {
  appId: string;
  apiKey: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const { appId, apiKey } = requireOneSignalKeys();
  const res = await onesignalRequest("/notifications", { appId, apiKey }, "POST", {
    app_id: appId,
    include_email_tokens: [opts.to],
    email_subject: opts.subject,
    email_body: opts.body,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg = json.errors?.[0]?.message ?? `OneSignal email failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return { id: json.id ?? json.notification_id ?? "unknown" };
}

async function sendSms(opts: {
  appId: string;
  apiKey: string;
  to: string;
  body: string;
}): Promise<{ id: string }> {
  const { appId, apiKey } = requireOneSignalKeys();
  const from = getSmsFrom();
  const res = await onesignalRequest("/notifications", { appId, apiKey }, "POST", {
    app_id: appId,
    include_phone_numbers: [opts.to],
    contents: { en: opts.body },
    ...(from ? { sms_from: from } : {}),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg = json.errors?.[0]?.message ?? `OneSignal SMS failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return { id: json.id ?? json.notification_id ?? "unknown" };
}

async function sendPush(opts: {
  appId: string;
  apiKey: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const { appId, apiKey } = requireOneSignalKeys();
  const res = await onesignalRequest("/notifications", { appId, apiKey }, "POST", {
    app_id: appId,
    include_external_user_ids: [opts.to],
    contents: { en: opts.body },
    headings: { en: opts.subject },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg = json.errors?.[0]?.message ?? `OneSignal push failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    if (msg.includes("player") || msg.includes("external_user_id") || msg.includes("not subscribed")) {
      throw new PlayerNotRegisteredError("push");
    }
    throw err;
  }
  const json = await res.json();
  return { id: json.id ?? json.notification_id ?? "unknown" };
}

export async function dispatchViaOneSignal(opts: {
  channel: Channel;
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  switch (opts.channel) {
    case "email":
      return sendEmail(opts);
    case "sms":
      return sendSms(opts);
    case "push":
      return sendPush(opts);
    default:
      throw new Error(`unsupported channel: ${opts.channel}`);
  }
}

// Exported for callers to resolve keys at request time
export function requireOneSignalKeysAtRuntime(): { appId: string; apiKey: string } {
  return requireOneSignalKeys();
}

export const CHANNELS = ["email", "sms", "push"] as const;