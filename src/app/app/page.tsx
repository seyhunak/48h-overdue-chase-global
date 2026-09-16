import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overdue invoice chase workbench",
  description: "Upload overdue invoices, validate, preview the chase sequence, export PDF + CSV.",
  alternates: { canonical: "/app" },
};

export { default } from "@/presentation/workbench-page";
