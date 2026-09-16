import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OneSignal provider setup",
  description: "Configure OneSignal app ID and API key, check channel status, and send a test.",
  alternates: { canonical: "/connect" },
};

export const dynamic = "force-dynamic";

export { default } from "@/presentation/connect-page";