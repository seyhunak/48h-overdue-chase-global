// Infrastructure — channel-agnostic notification dispatch (SERVER ONLY).
// Preferred path: the owner's own Composio project → ONESIGNAL_REST_API
// connected account (no OneSignal key stored in this app).
// Fallback path: server env ONESIGNAL_APP_ID / ONESIGNAL_API_KEY, so an
// existing deployment keeps sending before anyone visits /connect.

import { dispatchViaOneSignal } from "./onesignal";
import {
  dispatchViaComposioOneSignal,
  resolveComposioKey,
  resolveEntityId,
  ChannelNotConnectedError,
  MissingOneSignalAppIdError,
} from "./composio";
import type { OwnerConnectSettings } from "./owner-settings";

export type NotifyChannel = "email" | "sms" | "push";

export type DispatchResult = {
  id: string;
  via: "composio" | "onesignal";
  connectedAccountId?: string;
  recipients: number | null;
};

export async function dispatchNotification(opts: {
  settings: OwnerConnectSettings;
  channel: NotifyChannel;
  to: string;
  subject: string;
  body: string;
}): Promise<DispatchResult> {
  const { channel, to, subject, body } = opts;
  const appId = opts.settings?.onesignalAppId?.trim() || process.env.ONESIGNAL_APP_ID?.trim() || "";

  // Composio is the primary path whenever the owner saved a key. A missing
  // OneSignal App ID there is a real configuration error (not a fallback).
  let composioKey = "";
  try {
    composioKey = resolveComposioKey(opts.settings?.composioKey);
  } catch {
    composioKey = "";
  }

  if (composioKey) {
    if (!appId) throw new MissingOneSignalAppIdError();
    try {
      const sent = await dispatchViaComposioOneSignal({
        apiKey: composioKey,
        entityId: resolveEntityId(opts.settings?.composioUser),
        appId,
        channel,
        to,
        subject,
        body,
      });
      return { id: sent.id, via: "composio", connectedAccountId: sent.accountId, recipients: sent.recipients };
    } catch (e) {
      // No working OneSignal connection in the owner's Composio project (never
      // connected, or every ACTIVE account rejected by OneSignal). Fall back
      // to the server env keys so approved follow-ups still send — the direct
      // path throws its own clear error when it is not configured either, in
      // which case the original /connect guidance is the actionable one.
      if (!(e instanceof ChannelNotConnectedError)) throw e;
      try {
        const sent = await dispatchViaOneSignal({ channel, to, subject, body });
        return { id: sent.id, via: "onesignal", recipients: sent.recipients };
      } catch {
        throw e;
      }
    }
  }

  const sent = await dispatchViaOneSignal({ channel, to, subject, body });
  return { id: sent.id, via: "onesignal", recipients: sent.recipients };
}
