import { categoryEditorial } from "@/data/seo-editorial";
import type { Metadata } from "next";
import Link from "next/link";
import { GameArt } from "@/components/library/GameArt";
import { SITE_URL, publicGames, gamePath, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Jeux multijoueurs en ligne à jouer entre amis",
  description: "Explore les jeux de cartes, quiz, jeux de dés, de stratégie et d’action disponibles sur Revanche Games.",
  alternates: { canonical: "/jeux" },
  robots: { index: true, follow: true },
  openGraph: { title: "Les jeux de Revanche Games", url: "/jeux", type: "website" },
};
export default function GamesPage() {
  const games = publicGames();
  const data = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: games.map((game, index) => ({ "@type": "ListItem", position: index + 1, url: SITE_URL + gamePath(game.id), name: game.name })) };
  return <div className="rg-page rg-library-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
    <header className="mb-6"><h1 className="text-3xl font-bold">Jeux multijoueurs en ligne</h1><p className="mt-2">Découvre le catalogue de Revanche Games : jeux multijoueurs sur navigateur, jeux de cartes entre amis, quiz de culture générale, jeux de dés et jeux de stratégie. Choisis une activité adaptée au nombre de joueurs et retrouve tes proches à distance.</p></header>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {games.map(game => <article key={game.id} className="overflow-hidden rounded-xl border border-border-soft bg-void p-4"><Link href={gamePath(game.id)}><div className="relative aspect-video overflow-hidden rounded-lg"><GameArt game={game} className="h-full w-full" /></div><h2 className="mt-3 text-xl font-bold">{game.name}</h2></Link><p className="mt-2">{game.description}</p><p className="my-2 text-sm">{game.players}</p><Link className="rg-primary-button" href={gamePath(game.id)}>Découvrir {game.name}</Link></article>)}
    </div>
    <section className="my-6"><h2 className="text-xl font-bold">Trouve un jeu selon tes envies</h2><ul className="mt-3 space-y-2">{categoryEditorial.filter(c => games.some(g => g.categories.includes(c.category))).map(c => <li key={c.slug}><Link className="rg-text-link" href={"/categories/" + c.slug}>{c.title}</Link></li>)}</ul></section>
    <section className="my-6"><h2 className="text-xl font-bold">Jouer à distance avec tes amis francophones</h2><p className="my-2">Retrouve tes proches en France, en Suisse et en Belgique sur une même plateforme.</p><Link className="rg-text-link" href="/communaute-francophone">Découvrir la communauté francophone</Link><p className="mt-3"><Link className="rg-text-link" href="/suisse">Jeux en ligne en Suisse romande</Link></p></section>
    <Link className="rg-text-link mt-6" href="/library">Voir la bibliothèque complète</Link>
  </div>;
}
