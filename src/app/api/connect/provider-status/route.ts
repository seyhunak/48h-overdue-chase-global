import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // OneSignal config presence only — never leak keys.
  const hasAppId = Boolean(process.env.ONESIGNAL_APP_ID?.trim());
  const hasApiKey = Boolean(process.env.ONESIGNAL_API_KEY?.trim());
  const hasEmailFrom = Boolean(process.env.ONESIGNAL_EMAIL_FROM?.trim());
  const hasSmsFrom = Boolean(process.env.ONESIGNAL_SMS_FROM?.trim());

  const configured = hasAppId && hasApiKey;

  return NextResponse.json({
    configured,
    hasAppId,
    hasApiKey,
    hasEmailFrom,
    hasSmsFrom,
    channels: {
      email: hasAppId && hasApiKey && hasEmailFrom,
      sms: hasAppId && hasApiKey && hasSmsFrom,
      push: hasAppId && hasApiKey,
    },
  });
}