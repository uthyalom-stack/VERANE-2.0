import type { Metadata } from "next";
import { Bodoni_Moda, Instrument_Sans, Syne } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCurrentUser } from "@/lib/http/session";
import { peekCartId } from "@/lib/http/cart-cookie";
import { getDb } from "@/infrastructure/db/client";
import { cartItems } from "@/infrastructure/db/schema";
import { eq, sql } from "drizzle-orm";
import "@/styles/globals.css";

const bodoni = Bodoni_Moda({ subsets: ["latin"], variable: "--font-bodoni", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", display: "swap" });

const appUrl = process.env.APP_URL ?? "http://localhost:3000"; // never hardcode a production domain
export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "VÉRANE — Two Brands. One Expression.", template: "%s — VÉRANE" },
  description: "A digital fashion house: UTHY LUXURY and ALOMZIEE FOOTIES.",
  openGraph: { siteName: "VÉRANE", type: "website" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, cartId] = await Promise.all([getCurrentUser(), peekCartId()]);
  const [row] = cartId ? await getDb().select({ n: sql<number>`coalesce(sum(${cartItems.quantity}),0)` }).from(cartItems).where(eq(cartItems.cartId, cartId)) : [];
  const orgLd = { "@context": "https://schema.org", "@type": "Organization", name: "VÉRANE", url: appUrl, brand: [{ "@type": "Brand", name: "UTHY LUXURY" }, { "@type": "Brand", name: "ALOMZIEE FOOTIES" }] };
  return (
    <html lang="en" className={`${bodoni.variable} ${instrument.variable} ${syne.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg">Skip to content</a>
        <SiteHeader cartCount={Number(row?.n ?? 0)} signedIn={user?.kind === "customer"} />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
