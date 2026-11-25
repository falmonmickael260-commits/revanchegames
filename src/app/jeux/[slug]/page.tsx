import type { Metadata } from "next";
import { editorial } from "@/data/seo-editorial";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameArt } from "@/components/library/GameArt";
import { SITE_URL, SITE_NAME, gamePath, publicGames, jsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return publicGames().map(game => ({ slug: game.id })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = publicGames().find(g => g.id === slug);
  if (!game) return { title: "Jeu indisponible", robots: { index: false, follow: false } };
  const title = editorial[slug]?.title ?? game.name + " – Jeu en ligne";
  return { title, description: game.description, alternates: { canonical: gamePath(slug) }, robots: { index: true, follow: true }, openGraph: { title, description: game.description, url: gamePath(slug), type: "website", ...(game.image ? { images: [game.image] } : {}) } };
}
export default async function GameInfoPage({ params }: Props) {
  const { slug } = await params;
  const game = publicGames().find(g => g.id === slug);
  if (!game) notFound();
  const url = SITE_URL + gamePath(game.id);
  const guide = editorial[slug];
  const related = publicGames().filter(other => other.id !== game.id && other.categories.some(category => game.categories.includes(category))).slice(0, 4);
  const labels = { cartes: "Cartes", plateau: "Plateau", quiz: "Quiz", ambiance: "Ambiance", strategie: "Stratégie", action: "Action", des: "Dés", sport: "Sport" };
  const data = { "@context": "https://schema.org", "@type": "VideoGame", name: game.name, description: game.description, url, inLanguage: "fr", gamePlatform: "Navigateur web", genre: game.categories.map(category => labels[category]), ...(game.image ? { image: SITE_URL + game.image } : {}), publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL } };
  return <div className="rg-page rg-library-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
    <nav className="mb-4" aria-label="Fil d’Ariane"><Link className="rg-text-link" href="/jeux">Tous les jeux</Link> / {game.name}</nav>
    <article className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-border-soft bg-void p-5">
      <div className="relative aspect-video overflow-hidden rounded-lg"><GameArt game={game} className="h-full w-full" /></div>
      <h1 className="mt-5 text-3xl font-bold">{guide?.title ?? game.name + " – Jeu en ligne"}</h1>
      <p className="mt-2 text-lg">{game.tagline}</p>
      <p className="mt-4">{game.description}</p>
      <dl className="my-5 space-y-2"><div><dt className="font-bold">Nombre de joueurs</dt><dd>{game.players}</dd></div><div><dt className="font-bold">Catégories</dt><dd>{game.categories.map(category => labels[category]).join(", ")}</dd></div></dl>
      <Link className="rg-primary-button" href={"/play/" + game.id}>Jouer à {game.name}</Link>
    </article>
    {guide && <section className="mx-auto mt-6 max-w-3xl rounded-xl border border-border-soft p-5"><h2 className="text-xl font-bold">Comment jouer à {game.name} ?</h2><p className="mt-3">{guide.intro}</p><h2 className="mt-5 text-xl font-bold">Conseils pour progresser</h2><ul className="mt-3 list-disc space-y-2 pl-5">{guide.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></section>}
    {related.length > 0 && <section className="mx-auto mt-6 max-w-3xl p-5"><h2 className="text-xl font-bold">D’autres jeux à découvrir</h2><ul className="mt-3 space-y-2">{related.map(other => <li key={other.id}><Link className="rg-text-link" href={gamePath(other.id)}>{other.name}</Link></li>)}</ul></section>}
  </div>;
}
