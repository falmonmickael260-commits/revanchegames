"use client";
import { GAMES } from "@/data/games";
import { useSocial } from "@/components/social/SocialProvider";
import { useRecentGames } from "@/lib/use-recent-games";
import { GameTile } from "@/components/home/GameTile";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
export default function RecentPage() {
  const {me}=useSocial();
  const recent = useRecentGames(me?.id);
  const games = recent.flatMap(entry => GAMES.filter(game => game.id === entry.id && game.enabled));
  return <div className="rg-page"><PageHeader eyebrow="Mes jeux" title="On reprend ?" subtitle="Tes parties terminées et les jeux récemment ouverts sur cet appareil." />{games.length ? <div className="rg-home-games mt-6">{games.map(game => <GameTile key={game.id} game={game} />)}</div> : <div className="rg-inline-empty mt-6"><p>Aucun jeu ouvert pour l’instant.</p><Link href="/library">Découvrir les jeux</Link></div>}</div>;
}
