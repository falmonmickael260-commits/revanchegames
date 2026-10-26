import Link from "next/link";
import { Crown, Minus, Swords } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { GAMES } from "@/data/games";
import type { Match } from "@/lib/social/stats";

function gameName(slug: string): string {
  return GAMES.find((game) => game.id === slug)?.name ?? slug;
}

function relativeDate(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * L'historique des parties : qui a joué, qui a gagné, quand.
 *
 * Les invités y figurent au même titre que les comptes — ils ont joué la
 * partie, les masquer donnerait une liste de participants fausse. Seuls les
 * comptes sont cliquables, puisqu'eux seuls ont un profil.
 *
 * Composant serveur : il n'a aucun état, inutile de l'envoyer au navigateur.
 */
export function MatchList({
  matches,
  highlightUserId,
  emptyMessage = "Aucune partie enregistrée pour l'instant.",
}: {
  matches: Match[];
  /** Met ce joueur en évidence — utilisé sur sa propre page de profil. */
  highlightUserId?: string;
  emptyMessage?: string;
}) {
  if (matches.length === 0) {
    return (
      <p className="rounded-xl border border-border-soft bg-surface px-4 py-3.5 font-body text-sm text-text-faint">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {matches.map((match) => {
        const winners = match.players.filter((player) => player.outcome === "win");

        return (
          <li
            key={match.id}
            className="flex flex-col gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <Swords className="h-3.5 w-3.5 shrink-0 text-cyan" strokeWidth={2} />
                <span className="truncate font-display text-sm font-semibold text-text">
                  {gameName(match.gameSlug)}
                </span>
              </span>
              <span className="shrink-0 font-body text-[11px] text-text-faint">
                {relativeDate(match.finishedAt)}
              </span>
            </div>

            <ul className="flex flex-col gap-1">
              {match.players.map((player, index) => {
                const isMe = highlightUserId && player.userId === highlightUserId;
                const won = player.outcome === "win";

                const row = (
                  <>
                    <Avatar username={player.label} avatarUrl={player.avatarUrl} size="sm" />
                    <span
                      className={`min-w-0 flex-1 truncate font-body text-sm ${
                        isMe ? "font-semibold text-text" : "text-text-dim"
                      }`}
                    >
                      {player.label}
                      {player.userId === null && (
                        <span className="ml-1 font-body text-[11px] text-text-faint">
                          (invité)
                        </span>
                      )}
                    </span>

                    {player.score !== null && (
                      <span className="shrink-0 font-display text-xs text-text-faint">
                        {player.score}
                      </span>
                    )}

                    <span
                      className={`flex w-16 shrink-0 items-center justify-end gap-1 font-display text-xs font-semibold ${
                        won
                          ? "text-amber"
                          : player.outcome === "draw"
                            ? "text-text-faint"
                            : "text-text-faint"
                      }`}
                    >
                      {won ? (
                        <>
                          <Crown className="h-3.5 w-3.5" />
                          Victoire
                        </>
                      ) : player.outcome === "draw" ? (
                        <>
                          <Minus className="h-3.5 w-3.5" />
                          Nul
                        </>
                      ) : (
                        "Défaite"
                      )}
                    </span>
                  </>
                );

                // Seuls les comptes ont une fiche ; un invité n'en a pas.
                return (
                  <li
                    key={`${match.id}-${player.userId ?? player.label}-${index}`}
                    className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${
                      isMe ? "bg-cyan/[0.06]" : ""
                    }`}
                  >
                    {player.userId && !isMe ? (
                      <Link
                        href={`/profile/${player.userId}`}
                        className="flex min-w-0 flex-1 items-center gap-2 transition-opacity hover:opacity-80"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>

            {winners.length > 1 && (
              <p className="font-body text-[11px] text-text-faint">
                Partie à égalité en tête.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
