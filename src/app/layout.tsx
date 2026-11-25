import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { GiftCelebrationLayer } from "@/components/gifts/GiftCelebrationLayer";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, jsonLd } from "@/lib/seo";
import "./globals.css";
import "./refonte.css";
import "./gifts.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Revanche Games – Jeux multijoueurs en ligne entre amis", template: "%s | Revanche Games" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: { index: false, follow: true },
  openGraph: { siteName: SITE_NAME, locale: "fr_FR", type: "website", title: "Revanche Games – Jeux multijoueurs en ligne", description: SITE_DESCRIPTION, images: ["/icons/icon-512.png"] },
  twitter: { card: "summary", title: SITE_NAME, description: SITE_DESCRIPTION, images: ["/icons/icon-512.png"] },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Revanche Games",
  },
};

export const viewport: Viewport = {
  themeColor: "#080d16",
  width: "device-width",
  initialScale: 1,
  // La vue s'étend sous l'encoche et l'indicateur d'accueil ; les zones de
  // sécurité sont ensuite rendues par `env(safe-area-inset-*)`, exposées en
  // variables `--rg-safe-*` dans globals.css.
  viewportFit: "cover",
  // Le clavier virtuel redimensionne la mise en page au lieu de se superposer,
  // pour que la zone de saisie du chat reste visible pendant la frappe. Pris
  // en charge par Chrome Android ; sur iOS, `useKeyboardInset` fait le travail
  // à partir de `visualViewport`.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@graph": [{ "@type": "Organization", "@id": SITE_URL + "/#organization", name: SITE_NAME, url: SITE_URL, logo: SITE_URL + "/icons/icon-512.png" }, { "@type": "WebSite", "@id": SITE_URL + "/#website", name: SITE_NAME, url: SITE_URL, inLanguage: "fr", publisher: { "@id": SITE_URL + "/#organization" } }] }) }} />
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
        <GiftCelebrationLayer />
      </body>
    </html>
  );
}
