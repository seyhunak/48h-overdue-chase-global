import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your chase data",
  description: "Logged and tracked invoices, chase history, and vault log.",
  alternates: { canonical: "/data" },
};

export const dynamic = "force-dynamic";

export { default } from "@/presentation/data-page";
