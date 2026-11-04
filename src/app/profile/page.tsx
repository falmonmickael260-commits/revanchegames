import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Gamepad2, Trophy, Target, UserPlus, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/library/EmptyState";
import { FavoritesTile } from "@/components/profile/FavoritesTile";
import { SignOutButton } from "@/components/profile/SignOutButton";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { BannerEditor } from "@/components/profile/BannerEditor";
import { GhostModeCard } from "@/components/social/GhostModeCard";
import { MatchList } from "@/components/stats/MatchList";
import { LevelBadge, toProgress } from "@/components/stats/LevelBadge";
import { toMatches } from "@/lib/social/stats";
import { createClient } from "@/lib/supabase/server";
import { ProfileShortcuts } from "@/components/profile/ProfileShortcuts";
import { PurchaseHistory } from "@/components/shop/PurchaseHistory";

type GameStatsRow = {
  game_slug: string;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number | null;
};

// The session lives in cookies, so it's only known at request time — wrapping
// it in Suspense keeps the route's static shell prerenderable (Next.js 16
// Cache Components) while the real profile streams in below the fallback.
export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileSkeleton() {
  return (
    <div className="rg-page rg-profile-page flex flex-col gap-6">
      <PageHeader eyebrow="Ton espace joueur" title="Mon profil" />
      <div className="h-24 animate-pulse rounded-2xl border border-border-soft bg-surface" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[66px] animate-pulse rounded-xl border border-border-soft bg-surface" />
        ))}
      </div>
    </div>
  );
}

async function ProfileContent() {
  // `toLocaleDateString` below resolves the current timezone, which Next.js's
  // Cache Components treat as an unstable `Date.now()` read during
  // prerendering — `connection()` marks this subtree as request-time only.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return (
      <div className="rg-page rg-profile-page flex flex-col gap-6">
        <PageHeader eyebrow="Ton espace joueur" title="Mon profil" />
        <EmptyState
          icon={UserPlus}
          title="Pas encore connecté"
          message="Crée un compte pour retrouver tes amis, tes statistiques et tes conversations, depuis n’importe quel appareil."
          action={
            <div className="flex gap-2">
              <Link
                href="/sign-up"
                className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2 font-display text-sm font-semibold text-void"
              >
                Créer un compte
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border border-border-soft px-4 py-2 font-display text-sm font-semibold text-text-dim"
              >
                Se connecter
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const [
    { data: profile },
    { data: catalog },
    { data: stats },
    { data: totals },
    { data: matchRows },
    { data: progressRows },
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, avatar_url, created_at, player_tag, signature")
        .eq("id", user.id)
        .single(),
      supabase.from("game_catalog").select("slug, display_name, sort_order").order("sort_order"),
      supabase
        .from("game_stats")
        .select("game_slug, games_played, wins, losses, draws, win_rate")
        .eq("user_id", user.id),
      supabase
        .from("game_stats_totals")
        .select("games_played, wins, losses, draws, win_rate")
        .eq("user_id", user.id)
        .maybeSingle(),
      // Les dernières parties de ce joueur, invités compris.
      supabase.rpc("recent_matches", { p_user_id: user.id, p_limit: 10 }),
      // XP et niveau, recalculés depuis les parties réelles.
      supabase.rpc("player_progress", { p_user_id: user.id }),
    ]);

  const matches = toMatches(matchRows);
  const progress = toProgress(progressRows);

  const statsBySlug = new Map((stats as GameStatsRow[] | null)?.map((s) => [s.game_slug, s]));
  const username = profile?.username ?? "Joueur";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })
    : null;
  // Requête séparée pour que le profil reste accessible avant l'application
  // de la migration qui ajoute la colonne de couverture.
  const { data: bannerProfile } = await supabase.from("profiles").select("banner_url").eq("id", user.id).maybeSingle();

  return (
    <div className="rg-page rg-profile-page flex flex-col gap-6">
      <PageHeader eyebrow="Ton espace joueur" title="Mon profil" />

      {/* En colonne sur mobile, côte à côte à partir de sm : forcer le
          côte-à-côte plus tôt laissait à peine ~90px à l'avatar + pseudo +
          identifiant sur un écran étroit (« Déconnexion » ne masque jamais
          son texte, contrairement à « Paramètres ») — au point que le champ
          de saisie de l'identifiant devenait fonctionnellement invisible. */}
      <div className="rg-profile-identity flex flex-col items-start gap-4 p-6 sm:flex-row sm:justify-between">
        <BannerEditor initialUrl={bannerProfile?.banner_url ?? null} />
        <div className="min-w-0 w-full sm:flex-1">
          <ProfileEditor
            userId={user.id}
            initialUsername={username}
            initialAvatarUrl={profile?.avatar_url ?? null}
            initialPlayerTag={profile?.player_tag ?? null}
            initialSignature={profile?.signature ?? null}
          />
          <p className="mt-2 font-body text-sm text-text-faint">
            {memberSince ? `Membre depuis ${memberSince}` : "Membre Revanche Game"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Seul accès aux paramètres sur mobile : la barre latérale qui les
              proposait n'existe qu'à partir de lg, et c'est là qu'on active
              les notifications — le réglage le plus utile sur téléphone. */}
          <Link
            href="/settings"
            aria-label="Paramètres"
            className="flex items-center gap-1.5 rounded-lg border border-border-soft px-3 py-2 font-display text-xs font-semibold text-text-dim transition-colors hover:border-border hover:text-text"
          >
            <Settings className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Paramètres</span>
          </Link>
          <SignOutButton />
        </div>
      </div>

      {/* Le mode fantôme est ici, et pas seulement dans les paramètres : on
          décide de se rendre invisible au moment d'aller jouer, pas en
          explorant des réglages. C'est le même réglage des deux côtés. */}
      {progress && <LevelBadge progress={progress} />}

      <ProfileShortcuts />
      <details className="rg-profile-privacy"><summary>Ma présence et ma confidentialité</summary><div className="mt-3"><GhostModeCard /></div></details>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FavoritesTile />
        <StatTile icon={Gamepad2} label="Parties jouées" value={totals?.games_played ?? 0} />
        <StatTile icon={Trophy} label="Victoires" value={totals?.wins ?? 0} />
        <StatTile
          icon={Target}
          label="Taux de victoire"
          value={totals?.win_rate != null ? `${totals.win_rate}%` : "—"}
        />
      </div>

      <section><h2 className="mb-4 text-lg font-bold">Mes statistiques par jeu</h2><div className="rg-profile-game-stats">{(catalog??[]).map(game=>{const row=statsBySlug.get(game.slug);return <article key={game.slug}><h3>{game.display_name}</h3><div><span><strong>{row?.games_played??0}</strong>Parties</span><span><strong>{row?.wins??0}</strong>Victoires</span><span><strong>{row?.losses??0}</strong>Défaites</span><span><strong>{row?.win_rate!=null?`${row.win_rate}%`:"—"}</strong>Réussite</span></div></article>;})}</div><p className="mt-3 text-xs text-text-faint">Résultats réellement transmis par les jeux après les parties.</p></section>

      {/* ---- Historique ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
          Mes dernières parties
        </h2>
        <MatchList
          matches={matches}
          highlightUserId={user.id}
          emptyMessage="Aucune partie enregistrée pour l'instant. Lance une partie : le résultat apparaîtra ici dès qu'elle sera terminée."
        />
      </section>
      <PurchaseHistory />
    </div>
  );
}
