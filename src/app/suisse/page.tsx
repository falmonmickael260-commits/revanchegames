import type { Metadata } from "next";
import Link from "next/link";
import { publicGames, gamePath, SITE_URL, SITE_NAME, jsonLd } from "@/lib/seo";

const title = "Jeux en ligne en Suisse romande – jouer entre amis";
const description = "Revanche Games Suisse : retrouve tes amis en ligne depuis Genève, Lausanne, Fribourg, Neuchâtel ou le Valais. Jeux de cartes, quiz, stratégie et salons vocaux en français.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/suisse" },
  robots: { index: true, follow: true },
  openGraph: { title: title + " | Revanche Games", description, url: "/suisse", locale: "fr_CH", siteName: SITE_NAME, type: "website", images: ["/icons/icon-512.png"] },
};

const regions = [
  ["Genève", "Genève, Carouge, Vernier et Meyrin"],
  ["Vaud", "Lausanne, Nyon, Morges, Montreux, Vevey et Yverdon-les-Bains"],
  ["Valais", "Sion, Sierre, Martigny et Monthey"],
  ["Fribourg", "Fribourg, Bulle et Romont"],
  ["Neuchâtel", "Neuchâtel, La Chaux-de-Fonds et Le Locle"],
  ["Jura", "Delémont et Porrentruy"],
  ["Jura bernois et Bienne", "Saint-Imier, Tramelan et Bienne"],
];

const picks = ["kilomax", "president", "quiz-master", "camouflip", "la-meute", "bombshift", "dominorush", "10000", "fortune-empire"];

export default function SuissePage() {
  const games = publicGames().filter(game => picks.includes(game.id));
  return <article className="rg-page rg-library-page" lang="fr-CH">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: SITE_URL + "/suisse",
      inLanguage: "fr-CH",
      isPartOf: { "@id": SITE_URL + "/#website" },
      audience: { "@type": "Audience", geographicArea: { "@type": "Country", name: "Suisse" } },
    }) }} />
    <header className="mb-6">
      <p className="text-sm font-semibold">Suisse romande · Jeux multijoueurs en français</p>
      <h1 className="my-3 text-3xl font-bold">Revanche Games Suisse : joue en ligne avec tes amis</h1>
      <p>Envie d'organiser une soirée jeux à distance depuis Genève, Lausanne ou ailleurs en Suisse romande ? Revanche Games rassemble plusieurs jeux en ligne dans un même espace francophone. Choisis un quiz, un jeu de cartes ou une partie de stratégie, invite tes proches et retrouve-les depuis ton navigateur.</p>
      <div className="my-4 flex flex-wrap gap-3"><Link className="rg-primary-button" href="/jeux">Découvrir les jeux</Link><Link className="rg-text-link" href="/sign-up">Créer mon compte</Link></div>
    </header>
    <section className="my-6">
      <h2 className="text-xl font-bold">Quels jeux choisir pour une soirée entre amis en Suisse ?</h2>
      <p className="my-3">Pour une courte pause, essaie un quiz ou un jeu de dés. Pour une soirée en groupe, privilégie les jeux de déduction ou les cartes. À deux, découvre les jeux proposant un mode coopératif. Vérifie le nombre de joueurs indiqué sur chaque fiche.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {games.map(game => <div key={game.id} className="rounded-xl border border-border-soft bg-void p-4">
        <h3 className="font-bold">{game.name}</h3><p className="my-2 text-sm">{game.description}</p><p className="my-2 text-sm">{game.players}</p>
        <Link className="rg-text-link" href={gamePath(game.id)}>Découvrir {game.name}</Link>
      </div>)}
      </div>
    </section>
    <section className="my-6 rounded-xl border border-border-soft p-5">
      <h2 className="text-xl font-bold">Jouer à distance depuis les cantons romands</h2>
      <p className="my-3">Que tes amis habitent dans ton canton, dans une autre région de Suisse ou en France et en Belgique, les parties en ligne permettent de vous retrouver sans vous déplacer. Voici quelques régions et villes depuis lesquelles organiser votre prochaine soirée.</p>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{regions.map(([region, cities]) => <div key={region}><dt className="font-semibold">{region}</dt><dd>{cities}</dd></div>)}</dl>
      <p className="mt-3 text-sm">Ces lieux indiquent le public auquel ce guide s'adresse, pas des établissements ni des groupes locaux vérifiés.</p>
    </section>
    <section className="my-6">
      <h2 className="text-xl font-bold">Comment organiser une partie depuis la Suisse ?</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6"><li>Ouvre le catalogue depuis ton téléphone ou ton ordinateur.</li><li>Choisis un jeu adapté à votre groupe et crée ton compte si nécessaire.</li><li>Crée ou rejoins un salon selon les options du jeu, puis partage ton invitation ou le code de la partie.</li><li>Retrouve tes amis et utilise les salons vocaux de la plateforme si tu souhaites discuter ensemble.</li></ol>
      <p>Les fonctionnalités, conditions de connexion et options d'achat varient selon les jeux. Consulte les informations affichées avant tout achat.</p>
    </section>
    <section className="my-6">
      <h2 className="text-xl font-bold">Questions fréquentes des joueurs suisses</h2>
      <h3 className="mt-4 font-semibold">Peut-on jouer en français depuis la Suisse ?</h3><p>La plateforme est conçue pour les joueurs francophones et se consulte en ligne.</p>
      <h3 className="mt-4 font-semibold">Peut-on jouer avec des amis en France ou en Belgique ?</h3><p>Oui, les salons en ligne permettent aux joueurs de se retrouver à distance selon les modalités du jeu choisi.</p>
      <h3 className="mt-4 font-semibold">Faut-il télécharger une application ?</h3><p>Tu peux commencer depuis ton navigateur. La compatibilité dépend du jeu et de ton appareil.</p>
    </section>
    <nav className="my-6 flex flex-wrap gap-4" aria-label="Découvrir Revanche Games"><Link className="rg-text-link" href="/categories/cartes">Jeux de cartes</Link><Link className="rg-text-link" href="/categories/quiz">Quiz en ligne</Link><Link className="rg-text-link" href="/communaute-francophone">Communauté francophone</Link><Link className="rg-text-link" href="/">Accueil Revanche Games</Link></nav>
  </article>;
}
