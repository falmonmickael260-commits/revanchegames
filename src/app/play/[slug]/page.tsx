import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GAMES } from "@/data/games";
import { createPlatformToken } from "@/lib/platform-token";
import { createClient } from "@/lib/supabase/server";

function resolveGameUrl(slug: string, fallback?: string): string | undefined {
  const envKey = `GAME_URL_${slug.toUpperCase().replace(/-/g, "_")}`;
  return process.env[envKey] || fallback;
}

// The catalog is a static, fully-known list — pre-listing every enabled
// slug lets this dynamic route (and the shell's usePathname-based nav
// highlighting) be resolved at build time instead of blocking prerender.
export function generateStaticParams() {
  return GAMES.filter((g) => g.enabled).map((g) => ({ slug: g.id }));
}

// `slug` (route param) and the session (cookies) are both only known at
// request time, so the whole thing lives behind one Suspense boundary —
// see Next.js 16 Cache Components ("Maximizing the static shell").
export default function PlayGamePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-64px)] w-full animate-pulse bg-surface" />}>
      <GameFrame paramsPromise={params} />
    </Suspense>
  );
}

async function GameFrame({ paramsPromise }: { paramsPromise: Promise<{ slug: string }> }) {
  const { slug } = await paramsPromise;
  const game = GAMES.find((g) => g.id === slug);
  if (!game || !game.enabled) notFound();

  const targetUrl = resolveGameUrl(slug, game.url);
  if (!targetUrl) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  let iframeSrc = targetUrl;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    if (profile?.username) {
      const token = createPlatformToken({ id: user.id, username: profile.username });
      const separator = targetUrl.includes("?") ? "&" : "?";
      iframeSrc = `${targetUrl}${separator}rg_token=${encodeURIComponent(token)}`;
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col">
      <iframe
        src={iframeSrc}
        title={game.name}
        className="h-full w-full flex-1 border-0"
        allow="fullscreen; autoplay"
      />
    </div>
  );
}
