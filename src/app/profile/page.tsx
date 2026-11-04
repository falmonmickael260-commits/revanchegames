import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Gamepad2, Trophy, Target, UserPlus, Settings, CalendarDays, BarChart3, History, LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
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
import { GAMES } from "@/data/games";
import { GameArt } from "@/components/library/GameArt";

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

      <section className="rg-profile-identity" aria-label="Carte de joueur">
        <BannerEditor initialUrl={bannerProfile?.banner_url ?? null} />
        <div className="rg-profile-hero-main">
          <ProfileEditor
            userId={user.id}
            initialUsername={username}
            initialAvatarUrl={profile?.avatar_url ?? null}
            initialPlayerTag={profile?.player_tag ?? null}
            initialSignature={profile?.signature ?? null}
          />
          <div className="rg-profile-member-meta"><CalendarDays size={14} /> {memberSince ? `Membre depuis ${memberSince}` : "Membre Revanche Games"}</div>
        </div>
        <div className="rg-profile-hero-actions">
          <Link
            href="/settings"
            className="rg-profile-settings-link"
          >
            <Settings className="h-4 w-4" strokeWidth={2} />
            <span>Paramètres</span>
          </Link>
          <SignOutButton />
        </div>
        {progress && <div className="rg-profile-hero-level"><LevelBadge progress={progress} /></div>}
        <div className="rg-profile-record" aria-label="Bilan du joueur">
          <div><Trophy aria-hidden="true" /><strong>{totals?.wins ?? 0}</strong><span>Victoires</span></div>
          <div><Gamepad2 aria-hidden="true" /><strong>{totals?.games_played ?? 0}</strong><span>Parties</span></div>
          <div><Target aria-hidden="true" /><strong>{totals?.win_rate != null ? `${totals.win_rate}%` : "—"}</strong><span>Réussite</span></div>
        </div>
      </section>

      <nav className="rg-profile-section-nav" aria-label="Sections du profil">
        <a href="#profil-apercu"><LayoutGrid size={16} /> Aperçu</a>
        <a href="#profil-jeux"><BarChart3 size={16} /> Jeux</a>
        <a href="#profil-historique"><History size={16} /> Historique</a>
      </nav>

      <section id="profil-apercu" className="rg-profile-overview">
        <div className="rg-profile-section-heading"><div><span>TON UNIVERS</span><h2>Vue d’ensemble</h2></div><span>Revanche Games</span></div>
        <ProfileShortcuts />
        <div className="rg-profile-favorites"><FavoritesTile /></div>
        <details className="rg-profile-privacy"><summary>Ma présence et ma confidentialité</summary><div className="mt-3"><GhostModeCard /></div></details>
      </section>

      <section id="profil-jeux" className="rg-profile-games-section">
        <div className="rg-profile-section-heading"><div><span>TON PARCOURS</span><h2>Mes jeux</h2></div><Link href="/library">Voir les jeux</Link></div>
        <div className="rg-profile-game-stats">{(catalog??[]).map(game=>{const row=statsBySlug.get(game.slug);const art=GAMES.find(item=>item.id===game.slug);return <article key={game.slug} className="rg-profile-game-row"><div className="rg-profile-game-thumb">{art ? <GameArt game={art} className="h-full w-full" /> : <Gamepad2 aria-hidden="true" />}</div><div className="rg-profile-game-detail"><h3>{game.display_name}</h3><p>{row?.games_played??0} parties · {row?.wins??0} victoires</p><div className="rg-profile-game-meter" aria-label={`Taux de victoire : ${row?.win_rate!=null?`${row.win_rate}%`:"aucune donnée"}`}><span style={{width:`${Math.max(0,Math.min(100,Number(row?.win_rate??0)))}%`}} /></div></div><strong>{row?.win_rate!=null?`${row.win_rate}%`:"—"}</strong></article>;})}</div>
        <p className="mt-3 text-xs text-text-faint">Résultats réellement transmis par les jeux après les parties.</p>
      </section>

      {/* ---- Historique ---- */}
      <section id="profil-historique" className="rg-profile-history flex flex-col gap-3">
        <div className="rg-profile-section-heading"><div><span>TES MOMENTS</span><h2>Dernières parties</h2></div></div>
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
