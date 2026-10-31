import { PageHeader } from "@/components/ui/PageHeader";
import { CoinPackCard } from "@/components/shop/CoinPackCard";
import { ShopWalletSection } from "@/components/shop/ShopWalletSection";

const PACKS = [
  { name: "Découverte", coins: 1000, price: "1,19 €" },
  { name: "Standard", coins: 2000, price: "2,00 €" },
  { name: "Premium", coins: 5500, price: "4,99 €", highlight: true },
  { name: "Ultimate", coins: 12000, price: "9,99 €" },
];

export default function ShopPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Boutique"
        title="Pièces Revanche"
        subtitle="Une monnaie commune aux cinq jeux. Les paiements arrivent bientôt — en attendant, le code promo ci-dessous crédite ton compte pour de vrai."
      />

      <ShopWalletSection />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PACKS.map((pack) => (
          <CoinPackCard key={pack.name} {...pack} />
        ))}
      </div>

      <p className="text-center font-body text-sm text-text-faint">
        Les packs de pièces arrivent prochainement sur Revanche Game !
      </p>
    </div>
  );
}
