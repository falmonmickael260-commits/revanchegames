import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Revanche Games",
  description:
    "Revanche Games — joue, discute et retrouve tes amis. Tes jeux, messages, groupes et salons vocaux dans une seule application.",
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
  themeColor: "#f6f4ef",
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
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
