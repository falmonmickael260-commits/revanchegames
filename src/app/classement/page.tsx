import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { MatchList } from "@/components/stats/MatchList";
import { createClient } from "@/lib/supabase/server";
import { GAMES } from "@/data/games";
import { toLeaderboard, toMatches, type LeaderboardEntry } from "@/lib/social/stats";

const PLAYABLE = GAMES.filter((game) => game.enabled);

export default function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ jeu?: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton />}>
      <LeaderboardContent searchParamsPromise={searchParams} />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Compétition"
        title="Classement"
        subtitle="Calculé sur les parties réellement terminées, tous jeux confondus."
      />
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <Shell>
      <div className="h-10 animate-pulse rounded-full bg-surface" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl border border-border-soft bg-surface" />
      ))}
    </Shell>
  );
}

/**
 * Le classement, et les dernières parties de la plateforme.
 *
 * Rendu côté serveur : les deux listes arrivent déjà remplies. Le filtre par
 * jeu passe par l'URL (`?jeu=president`) plutôt que par un état client — on
 * peut ainsi partager un lien vers le classement d'un jeu précis.
 */
async function LeaderboardContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ jeu?: string }>;
}) {
  // `relativeDate` dans <MatchList> lit l'heure courante, que les Cache
  // Components traitent comme instable au prérendu.
  await connection();

  const { jeu } = await searchParamsPromise;
  // Un slug venant de l'URL n'est pas digne de confiance : on ne garde que
  // ceux du catalogue.
  const gameSlug = PLAYABLE.some((game) => game.id === jeu) ? jeu! : null;

  const supabase = await createClient();
  const [{ data: boardRows }, { data: matchRows }] = await Promise.all([
    supabase.rpc("leaderboard", { p_game_slug: gameSlug, p_limit: 50 }),
    supabase.rpc("recent_matches", { p_user_id: null, p_limit: 10 }),
  ]);

  const board = toLeaderboard(boardRows);
  const matches = toMatches(matchRows);

  return (
    <Shell>
      {/* Filtre par jeu — une barre qui défile plutôt qu'un menu : tous les
          jeux restent visibles d'un coup d'œil sur mobile. */}
      <div className="rg-rail gap-2 pb-1">
        <Chip href="/classement" active={gameSlug === null} label="Tous les jeux" />
        {PLAYABLE.map((game) => (
          <Chip
            key={game.id}
            href={`/classement?jeu=${game.id}`}
            active={gameSlug === game.id}
            label={game.name}
          />
        ))}
      </div>

      {board.length === 0 ? (
        <p className="rounded-xl border border-border-soft bg-surface px-4 py-3.5 font-body text-sm text-text-faint">
          Aucune partie enregistrée {gameSlug ? "sur ce jeu" : ""} pour l&apos;instant. Le
          classement se remplira dès les premières parties terminées.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {board.map((entry) => (
            <Row key={entry.userId} entry={entry} />
          ))}
        </ol>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
          Dernières parties
        </h2>
        <MatchList matches={matches} />
      </section>
    </Shell>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rg-snap-item shrink-0 rounded-full border px-3.5 py-1.5 font-display text-xs font-semibold transition-colors ${
        active
          ? "border-cyan/50 bg-cyan/10 text-cyan"
          : "border-border-soft bg-surface text-text-dim hover:border-border"
      }`}
    >
      {label}
    </Link>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  // Les trois premiers sont mis en avant — c'est ce qu'on vient regarder.
  const podium = entry.rank <= 3;

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        podium ? "border-amber/30 bg-amber/[0.04]" : "border-border-soft bg-surface"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold ${
          entry.rank === 1
            ? "bg-amber/20 text-amber"
            : podium
              ? "bg-surface-raised text-text-dim"
              : "text-text-faint"
        }`}
      >
        {entry.rank === 1 ? <Crown className="h-4 w-4" /> : entry.rank}
      </span>

      <Link
        href={`/profile/${entry.userId}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <Avatar username={entry.username} avatarUrl={entry.avatarUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-semibold text-text">
            {entry.username}
          </span>
          <span className="block font-body text-[11px] text-text-faint">
            {entry.gamesPlayed} partie{entry.gamesPlayed > 1 ? "s" : ""}
            {entry.draws > 0 && ` · ${entry.draws} nul${entry.draws > 1 ? "s" : ""}`}
          </span>
        </span>
      </Link>

      <span className="shrink-0 text-right">
        <span className="flex items-center justify-end gap-1 font-display text-sm font-semibold text-text">
          <Trophy className="h-3.5 w-3.5 text-amber" strokeWidth={2} />
          {entry.wins}
        </span>
        {entry.winRate !== null && (
          <span className="block font-body text-[11px] text-text-faint">{entry.winRate}%</span>
        )}
      </span>
    </li>
  );
}
