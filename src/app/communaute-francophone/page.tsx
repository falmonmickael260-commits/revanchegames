import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Jouer entre amis en France, Suisse et Belgique",
  description: "Retrouve tes amis à distance sur Revanche Games, depuis la France, la Suisse ou la Belgique. Jeux en ligne et communauté francophone.",
  alternates: { canonical: "/communaute-francophone" },
  robots: { index: true, follow: true },
};

const regions = [
  { name: "France", cities: "Paris, Marseille, Lyon, Toulouse, Nice, Nantes, Montpellier, Strasbourg, Bordeaux, Lille, Rennes, Reims, Saint-Étienne, Toulon, Grenoble, Dijon, Angers, Nîmes, Clermont-Ferrand, Le Mans, Aix-en-Provence, Brest, Tours, Amiens, Limoges, Annecy, Metz, Perpignan, Besançon, Orléans, Rouen, Nancy, Caen, Mulhouse, Avignon, Poitiers, Pau, La Rochelle, Chambéry, Valence, Romans-sur-Isère, Bourg-en-Bresse, Montélimar, Vienne, Cannes, Antibes, Bayonne, Biarritz, Béziers, Narbonne, Carcassonne, Colmar, Troyes, Chalon-sur-Saône, Mâcon, Roanne, Alès, Saint-Malo, Lorient, Vannes, Quimper, Saint-Nazaire, Cholet, Dunkerque, Calais, Arras, Lens, Douai, Valenciennes, Évreux, Chartres, Blois, Bourges, Châteauroux, Niort, Angoulême, Agen, Tarbes, Montauban, Albi, Castres, Rodez, Gap, Digne-les-Bains, Aurillac, Le Puy-en-Velay".split(", "), text: "Organise une partie à distance avec tes proches, même si vous habitez dans des régions différentes. Le catalogue permet de choisir des jeux de cartes, de quiz, de stratégie ou d’action selon vos envies." },
  { name: "Suisse", cities: "Genève, Lausanne, Fribourg, Neuchâtel, Sion, Montreux, Vevey, Nyon, Morges, Yverdon-les-Bains, La Chaux-de-Fonds, Le Locle, Bienne, Delémont, Porrentruy, Martigny, Monthey, Aigle, Sierre, Bulle, Romont, Estavayer, Payerne, Rolle, Gland, Versoix, Carouge, Meyrin, Vernier, Renens, Prilly, Épalinges, Zurich, Berne, Bâle, Lucerne, Lugano, Saint-Gall".split(", "), text: "Depuis la Suisse romande ou une autre région suisse, retrouve tes amis francophones pour jouer en ligne. Tu peux partager un lien vers un jeu et retrouver la communauté depuis ton navigateur." },
  { name: "Belgique", cities: "Bruxelles, Liège, Namur, Charleroi, Mons, Tournai, La Louvière, Verviers, Mouscron, Wavre, Nivelles, Ottignies-Louvain-la-Neuve, Waterloo, Braine-l’Alleud, Dinant, Huy, Spa, Eupen, Arlon, Bastogne, Marche-en-Famenne, Libramont-Chevigny, Ath, Soignies, Enghien, Lessines, Binche, Thuin, Philippeville, Couvin, Ciney, Andenne, Gembloux, Seraing, Herstal, Visé, Ans, Anvers, Gand, Bruges, Louvain, Malines, Hasselt, Courtrai, Ostende".split(", "), text: "Que tes amis résident en Wallonie, à Bruxelles ou ailleurs en Belgique, vous pouvez vous retrouver sur la même plateforme. Découvrez ensemble le catalogue et choisissez un jeu adapté à votre groupe." },
];

export default function FrancophonePage() {
  return <div className="rg-page rg-library-page">
    <h1 className="text-3xl font-bold">Jouer en ligne entre amis en France, Suisse et Belgique</h1>
    <p className="my-4">Revanche Games est une plateforme de jeux en ligne en français. La distance ne doit pas empêcher de partager une partie : retrouve tes proches depuis ton navigateur, où que vous habitiez.</p>
    <Link className="rg-primary-button" href="/jeux">Découvrir les jeux en ligne</Link>
    {regions.map(region => <section key={region.name} className="my-6 rounded-xl border border-border-soft p-5">
      <h2 className="text-xl font-bold">Jouer depuis {region.name === "Belgique" ? "la Belgique" : region.name === "France" ? "la France" : "la Suisse"}</h2><p className="my-3">{region.text}</p>
      {region.name === "Suisse" && <p className="my-3"><Link className="rg-text-link" href="/suisse">Revanche Games Suisse : guide pour jouer entre amis en Suisse romande</Link></p>}
      <details><summary>Exemples de villes depuis lesquelles jouer</summary><p className="mt-3 leading-relaxed">{region.cities.join(", ")}.</p></details>
    </section>)}
    <p className="my-4">Les parties se déroulent en ligne. Ces villes sont des exemples de lieux de connexion, et non des établissements ou des communautés locales dont la présence serait vérifiée.</p>
    <h2 className="text-xl font-bold">Choisir une activité à partager</h2>
    <ul className="my-4 space-y-2"><li><Link className="rg-text-link" href="/categories/cartes">Jeux de cartes entre amis</Link></li><li><Link className="rg-text-link" href="/categories/quiz">Quiz et culture générale</Link></li><li><Link className="rg-text-link" href="/categories/strategie">Jeux de stratégie</Link></li></ul>
  </div>;
}
