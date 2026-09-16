import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect OneSignal",
  description: "Connect OneSignal through Composio, check channel status, and send a test.",
  alternates: { canonical: "/connect" },
};

export const dynamic = "force-dynamic";

export { default } from "@/presentation/connect-page";