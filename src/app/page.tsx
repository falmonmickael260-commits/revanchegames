import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GAMES } from "@/data/games";
import { HomeView } from "@/components/home/HomeView";
export default function HomePage() {
  return <Suspense fallback={<div className="rg-page"><div className="rg-skeleton h-60" aria-label="Chargement de l’accueil" /></div>}><HomeContent /></Suspense>;
}
async function loadHomeSelection() {
  await connection();
  const db = await createClient();
  const { data } = await db.rpc("game_popularity");
  const cutoff = Date.now() - 30 * 86400000;
  return { popularIds:(data ?? []).map((row: {game_slug:string}) => row.game_slug), newIds: GAMES.filter(game => game.enabled && Date.parse(game.addedAt) >= cutoff).sort((a,b) => b.addedAt.localeCompare(a.addedAt)).map(game => game.id) };
}

async function HomeContent() { const selection=await loadHomeSelection(); return <HomeView {...selection} />; }
