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
import { createClient } from "@/lib/supabase/server";

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
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Compte" title="Profil" />
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
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader eyebrow="Compte" title="Profil" />
        <EmptyState
          icon={UserPlus}
          title="Pas encore connecté"
          message="Crée un compte Revanche Game pour retrouver tes statistiques sur Kilomax, Président, Quiz Master, La Meute et 10000 — depuis n'importe quel appareil."
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

  const [{ data: profile }, { data: catalog }, { data: stats }, { data: totals }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("username, avatar_url, created_at, player_tag")
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
    ]);

  const statsBySlug = new Map((stats as GameStatsRow[] | null)?.map((s) => [s.game_slug, s]));
  const username = profile?.username ?? "Joueur";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })
    : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Compte" title="Profil" />

      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex-1">
          <ProfileEditor
            userId={user.id}
            initialUsername={username}
            initialAvatarUrl={profile?.avatar_url ?? null}
            initialPlayerTag={profile?.player_tag ?? null}
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

      <div>
        <p className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.3em] text-violet">
          Statistiques par jeu
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border-soft">
          <table className="w-full min-w-[480px] border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-surface-raised text-left">
                <th className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-text-faint">
                  Jeu
                </th>
                <th className="px-4 py-3 text-right font-display text-xs font-semibold uppercase tracking-wider text-text-faint">
                  Parties
                </th>
                <th className="px-4 py-3 text-right font-display text-xs font-semibold uppercase tracking-wider text-text-faint">
                  Victoires
                </th>
                <th className="px-4 py-3 text-right font-display text-xs font-semibold uppercase tracking-wider text-text-faint">
                  Défaites
                </th>
                <th className="px-4 py-3 text-right font-display text-xs font-semibold uppercase tracking-wider text-text-faint">
                  Taux
                </th>
              </tr>
            </thead>
            <tbody>
              {(catalog ?? []).map((game) => {
                const row = statsBySlug.get(game.slug);
                return (
                  <tr key={game.slug} className="border-b border-border-soft bg-surface last:border-0">
                    <td className="px-4 py-3 font-display font-semibold text-text">{game.display_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-dim">
                      {row?.games_played ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-cyan">{row?.wins ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-dim">{row?.losses ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-dim">
                      {row?.win_rate != null ? `${row.win_rate}%` : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-surface-raised">
                <td className="px-4 py-3 font-display font-bold text-text">Total</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-text">
                  {totals?.games_played ?? 0}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-cyan">
                  {totals?.wins ?? 0}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-text">
                  {totals?.losses ?? 0}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-text">
                  {totals?.win_rate != null ? `${totals.win_rate}%` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-body text-xs text-text-faint">
          Alimentées par les résultats réels, envoyés par chaque jeu à la fin de la partie.
        </p>
      </div>
    </div>
  );
}
