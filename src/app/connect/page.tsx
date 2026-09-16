import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect follow-up channels",
  description: "Connect Gmail, WhatsApp, SMS, and voice via Composio for approved follow-up dispatch.",
  alternates: { canonical: "/connect" },
};

export const dynamic = "force-dynamic";

export { default } from "@/presentation/connect-page";
