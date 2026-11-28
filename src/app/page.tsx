import type { Metadata } from "next";
import { SITE_TITLE, SITE_DESCRIPTION } from "@/lib/seo";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GAMES } from "@/data/games";
import { HomeView } from "@/components/home/HomeView";
import { toProgress } from "@/components/stats/LevelBadge";
export const metadata: Metadata = { title: { absolute: SITE_TITLE }, description: SITE_DESCRIPTION, alternates: { canonical: "/" }, robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } } };
export default function HomePage() {
  return <Suspense fallback={<div className="rg-page"><div className="rg-skeleton h-60" aria-label="Chargement de l’accueil" /></div>}><HomeContent /></Suspense>;
}
async function loadHomeSelection() {
  await connection();
  if(process.env.RG_VISUAL_PREVIEW === "1") return {popularIds:[],newIds:GAMES.filter(game=>game.enabled&&game.newBadge).map(game=>game.id),progress:null};
  const db = await createClient();
  const [{ data }, { data: auth }] = await Promise.all([db.rpc("game_popularity"), db.auth.getUser()]);
  const progressResult = auth.user ? await db.rpc("player_progress", { p_user_id: auth.user.id }) : { data: null };
  const cutoff = Date.now() - 30 * 86400000;
  return { popularIds:(data ?? []).map((row: {game_slug:string}) => row.game_slug), newIds: GAMES.filter(game => game.enabled && Date.parse(game.addedAt) >= cutoff).sort((a,b) => b.addedAt.localeCompare(a.addedAt)).map(game => game.id), progress: toProgress(progressResult.data) };
}

async function HomeContent() { const selection=await loadHomeSelection(); return <HomeView {...selection} />; }
