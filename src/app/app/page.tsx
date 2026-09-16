import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overdue invoice follow-up workbench",
  description: "Upload overdue invoices, validate, preview the follow-up sequence, export PDF + CSV.",
  alternates: { canonical: "/app" },
};

export const dynamic = "force-dynamic";

export { default } from "@/presentation/workbench-page";
