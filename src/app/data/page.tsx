import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your follow-up data",
  description: "Logged and tracked invoices, follow-up history, and vault log.",
  alternates: { canonical: "/data" },
};

export const dynamic = "force-dynamic";

export { default } from "@/presentation/data-page";
