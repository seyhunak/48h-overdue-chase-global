import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect follow-up channels",
  description: "Email sends via Resend (no Gmail connection needed). Connect your own WhatsApp, SMS, and voice accounts via Composio for approved follow-up dispatch.",
  alternates: { canonical: "/connect" },
};

export const dynamic = "force-dynamic";

export { default } from "@/presentation/connect-page";
