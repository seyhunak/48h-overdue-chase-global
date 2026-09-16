import type { Metadata } from "next";
import "./globals.css";
import "@/presentation/tokens.css";
import "@/presentation/tally.css";
import { Providers } from "@/presentation/providers";
import { TopMenu } from "@/presentation/top-menu";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ClearDue — Clear overdue invoices without the awkward follow-up",
  description:
    "Founders at 5-50 person service firms recover overdue invoices in minutes: upload CSV, validate, send a 4-step follow-up sequence, export PDF + CSV.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "ClearDue — Clear overdue invoices without the awkward follow-up",
    description: "Upload 10 invoices — see cleared. 100 credits $99. Free 3 on signup.",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "ClearDue",
  description: "Overdue invoice follow-up workbench for service firms.",
    offers: { "@type": "Offer", price: "99", priceCurrency: "USD" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Providers>
          <TopMenu />
          <main>{children}</main>
          <footer className="tally-footer">
            <div className="tally__container">
              <p className="tally-footer__statement">
                ClearDue is a follow-up console for firms that would rather get <span className="italic-accent">paid</span> than follow up.
              </p>
              <div className="tally-footer__row">
                <div className="tally-footer__col">
                  <h5>Product</h5>
                  <ul>
                    <li>
                      <Link href="/about">About</Link>
                    </li>
                  </ul>
                </div>
                <div className="tally-footer__col">
                  <h5>Legal</h5>
                  <ul>
                    <li>
                      <Link href="/terms">Terms</Link>
                    </li>
                    <li>
                      <Link href="/privacy">Privacy</Link>
                    </li>
                  </ul>
                </div>
                <div className="tally-footer__col">
                  <h5>Connect</h5>
                  <ul>
                    <li>
                      <Link href="/contact">Contact</Link>
                    </li>
                  </ul>
                </div>
                <div className="tally-footer__col">
                  <h5>System</h5>
                  <ul>
                    <li>
                      <Link href="/sitemap.xml">Sitemap</Link>
                    </li>
                    <li>
                      <Link href="/robots.txt">Robots</Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="tally-footer__legal">
                <span>ClearDue</span>
                <span>© 2026 ClearDue · 100 credits $99 · 3 free on signup</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
