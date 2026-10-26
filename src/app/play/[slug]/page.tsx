import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { GAMES } from "@/data/games";
import { createPlatformToken } from "@/lib/platform-token";
import { createClient } from "@/lib/supabase/server";
import { GameMount } from "@/components/game/GameMount";

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
export default function PlayGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  // `?room=<code>` : posé quand on arrive par une invitation acceptée
  // (voir InvitationToast). Absent en navigation normale.
  searchParams: Promise<{ room?: string }>;
}) {
  return (
    <Suspense fallback={<GameBoot />}>
      <GameLauncher paramsPromise={params} searchParamsPromise={searchParams} />
    </Suspense>
  );
}

/**
 * Attente de la cible du jeu (session + jeton signés côté serveur).
 *
 * Volontairement calé sur la même géométrie que la scène de <GameViewport />
 * via `.rg-game-stage` : l'écran ne bouge pas d'un pixel quand le jeu
 * s'y substitue.
 */
function GameBoot() {
  return (
    <div className="rg-game-stage items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-cyan" />
    </div>
  );
}

/**
 * Ne rend pas le jeu : le déclare.
 *
 * L'iframe vit dans <GameViewport />, monté dans la coquille, pour que la
 * partie ne soit pas détruite dès que le joueur ouvre une autre section (voir
 * GameSessionProvider). Cette page reste responsable de ce qu'elle seule peut
 * faire — résoudre le slug et signer le jeton d'identité côté serveur.
 */
async function GameLauncher({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: Promise<{ slug: string }>;
  searchParamsPromise: Promise<{ room?: string }>;
}) {
  // createPlatformToken() below reads Date.now() (token iat/exp), which Next.js's
  // Cache Components treat as unstable during prerendering — connection() marks
  // this subtree as request-time only (see the same fix in app/profile/page.tsx).
  await connection();
  const { slug } = await paramsPromise;
  const { room } = await searchParamsPromise;
  // Le code de salon vient d'une URL : on n'y laisse passer que ce qui a la
  // forme d'un code, pour ne rien injecter dans l'URL du jeu.
  const roomCode = typeof room === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(room) ? room : null;

  const game = GAMES.find((g) => g.id === slug);
  if (!game || !game.enabled) notFound();

  const targetUrl = resolveGameUrl(slug, game.url);
  if (!targetUrl) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  // Paramètres ajoutés à l'URL du jeu. `rg_token` prouve l'identité du joueur
  // (signé côté serveur, vérifié par le jeu) ; `rg_room` indique le salon à
  // rejoindre quand on arrive par une invitation.
  const extra = new URLSearchParams();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    if (profile?.username) {
      extra.set("rg_token", createPlatformToken({ id: user.id, username: profile.username }));
    }
  }
  if (roomCode) extra.set("rg_room", roomCode);

  const separator = targetUrl.includes("?") ? "&" : "?";
  const iframeSrc = extra.size > 0 ? `${targetUrl}${separator}${extra.toString()}` : targetUrl;

  return <GameMount slug={slug} name={game.name} src={iframeSrc} roomCode={roomCode} />;
}
