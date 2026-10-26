import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Manrope } from "next/font/google";
import { IntroGate } from "@/components/intro/IntroGate";
import { AppShell } from "@/components/shell/AppShell";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Revanche Games",
  description:
    "Revanche Games — la bibliothèque de jeux entre amis. Cartes, plateau, bluff, stratégie et action, réunis dans un seul launcher.",
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
  themeColor: "#05070d",
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
      className={`${chakra.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ServiceWorkerRegister />
        <IntroGate>
          <AppShell>{children}</AppShell>
        </IntroGate>
      </body>
    </html>
  );
}
