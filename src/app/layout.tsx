import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/presentation/providers";
import { TopMenu } from "@/presentation/top-menu";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OverdueChase — Stop chasing overdue invoices",
  description:
    "Founders at 5-50 person service firms recover overdue invoices in minutes: upload CSV, validate, send a 4-step chase sequence, export PDF + CSV.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "OverdueChase — Stop chasing overdue invoices",
    description: "Upload 10 invoices — see cleared. 100 credits $1,000. Free 3 on signup.",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "OverdueChase",
  description: "Overdue invoice chase workbench for service firms.",
  offers: { "@type": "Offer", price: "1000", priceCurrency: "USD" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Providers>
          <TopMenu />
          <main>{children}</main>
          <footer className="mt-16 border-t">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-8 text-sm">
              <Link href="/about">About</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/sitemap.xml">Sitemap</Link>
              <Link href="/robots.txt">Robots</Link>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
