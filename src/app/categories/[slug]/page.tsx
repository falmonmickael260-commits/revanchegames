import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryEditorial } from "@/data/seo-editorial";
import { publicGames, gamePath } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };
const categories = () => categoryEditorial.filter(c => publicGames().some(g => g.categories.includes(c.category)));
export function generateStaticParams() { return categories().map(c => ({ slug: c.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = categories().find(x => x.slug === slug);
  if (!c) return { title: "Catégorie indisponible", robots: { index: false, follow: false } };
  return { title: c.title, description: c.description, alternates: { canonical: "/categories/" + slug }, robots: { index: true, follow: true }, openGraph: { title: c.title, description: c.description, url: "/categories/" + slug, type: "website" } };
}
export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const c = categories().find(x => x.slug === slug);
  if (!c) notFound();
  const games = publicGames().filter(g => g.categories.includes(c.category));
  return <div className="rg-page rg-library-page">
    <nav className="mb-4" aria-label="Fil d’Ariane"><Link href="/jeux" className="rg-text-link">Tous les jeux</Link> / {c.title}</nav>
    <h1 className="text-3xl font-bold">{c.title}</h1><p className="my-4">{c.description}</p>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{games.map(game => <article key={game.id} className="rounded-xl border border-border-soft p-5"><h2 className="text-xl font-bold"><Link href={gamePath(game.id)}>{game.name}</Link></h2><p className="my-3">{game.description}</p><p className="mb-3 text-sm">{game.players}</p><Link className="rg-primary-button" href={gamePath(game.id)}>Découvrir {game.name}</Link></article>)}</div>
    <section className="mt-6"><h2 className="text-xl font-bold">Autres catégories</h2><ul className="mt-3 space-y-2">{categories().filter(x => x.slug !== slug).map(x => <li key={x.slug}><Link className="rg-text-link" href={"/categories/" + x.slug}>{x.title}</Link></li>)}</ul></section>
  </div>;
}
