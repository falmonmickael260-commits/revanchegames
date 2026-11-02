import { PageHeader } from "@/components/ui/PageHeader";
import { CoinPackCard } from "@/components/shop/CoinPackCard";
import { ShopWalletSection } from "@/components/shop/ShopWalletSection";
import { PurchaseHistory } from "@/components/shop/PurchaseHistory";
import { COIN_PACKS, shopOrigin, stripeMode } from "@/lib/stripe/catalog";
import { Suspense } from "react";
import { connection } from "next/server";

const PACKS = [
  { ...COIN_PACKS.coins_1000, packId: "coins_1000" as const, price: "1,19 €" },
  { ...COIN_PACKS.coins_2000, packId: "coins_2000" as const, price: "2,00 €" },
  { name: "Premium", coins: 5500, price: "4,99 €", highlight: true },
  { name: "Ultimate", coins: 12000, price: "9,99 €" },
];

export default function ShopPage(props: { searchParams: Promise<{ payment?: string }> }) {
  return <Suspense fallback={<div className="p-8 text-text-dim">Chargement de la boutique…</div>}><ShopContent {...props} /></Suspense>;
}

async function ShopContent({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  await connection();
  const { payment } = await searchParams;
  let configured = false;
  let testMode = true;
  try {
    const live = stripeMode();
    testMode = !live;
    configured = !!shopOrigin() && !!process.env.STRIPE_WEBHOOK_SECRET &&
      new RegExp(`^(rk|sk)_${live ? "live" : "test"}_`).test(process.env.STRIPE_SECRET_KEY || "");
  } catch { /* A missing configuration leaves checkout disabled. */ }
  return (
    <div className="rg-page rg-shop-page flex flex-col gap-7">
      <PageHeader
        eyebrow="Boutique"
        title="Ton prochain coup de pouce."
        subtitle="Un portefeuille commun aux jeux compatibles. Retrouve tes pièces, tes achats et tes codes promo."
      />

      <ShopWalletSection />

      <div className="rg-coin-packs">
        {PACKS.map((pack) => (
          <CoinPackCard key={pack.name} {...pack} available={configured && "packId" in pack} testMode={testMode} />
        ))}
      </div>

      <p className="text-center font-body text-sm text-text-faint">
        Carte bancaire, Apple Pay, Google Pay et PayPal selon leur disponibilité sur la page Stripe.
      </p>
      <PurchaseHistory payment={payment} />
    </div>
  );
}
