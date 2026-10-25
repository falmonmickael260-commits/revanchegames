import { PageHeader } from "@/components/ui/PageHeader";
import { CoinPackCard } from "@/components/shop/CoinPackCard";

export default function ShopPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Boutique"
        title="Pièces Revanche"
        subtitle="Une monnaie commune aux cinq jeux, à venir. Les deux packs ci-dessous montrent ce qui arrive — aucun achat n'est possible pour l'instant."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CoinPackCard coins={1000} price="1,19 €" />
        <CoinPackCard coins={2000} price="2,00 €" highlight />
      </div>

      <p className="text-center font-body text-sm text-text-faint">
        Les packs de pièces arrivent prochainement sur Revanche Game !
      </p>
    </div>
  );
}
