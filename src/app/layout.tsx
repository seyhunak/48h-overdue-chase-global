import type { Metadata } from "next";
import "./globals.css";
import "@/presentation/tokens.css";
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Providers>
          <TopMenu />
          <main>{children}</main>
          <footer style={{ borderTop: "1px solid var(--color-rule)" }}>
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm">
              <span className="mono-label" style={{ color: "var(--color-muted)" }}>
                OverdueChase
              </span>
              <Link className="hallmark-link" href="/about">About</Link>
              <Link className="hallmark-link" href="/terms">Terms</Link>
              <Link className="hallmark-link" href="/privacy">Privacy</Link>
              <Link className="hallmark-link" href="/contact">Contact</Link>
              <Link className="hallmark-link" href="/sitemap.xml">Sitemap</Link>
              <Link className="hallmark-link" href="/robots.txt">Robots</Link>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
