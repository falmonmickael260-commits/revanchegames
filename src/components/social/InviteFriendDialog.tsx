"use client";

import { useState } from "react";
import { Gamepad2, X } from "lucide-react";
import { GAMES } from "@/data/games";
import { useGameSession } from "@/components/game/GameSessionProvider";
import { sendGameInvitation } from "@/lib/social/api";
import { requestPushDelivery } from "@/lib/push-client";
import type { FriendEntry } from "@/lib/social/types";

const PLAYABLE = GAMES.filter((game) => game.enabled);

/**
 * « Inviter à jouer » : choisir le jeu, puis envoyer.
 *
 * Si le joueur est déjà en partie, ce jeu et son salon sont présélectionnés —
 * c'est le cas d'usage principal : on invite un ami à venir *dans sa partie*,
 * sans avoir à lui dicter un code de salon.
 */
export function InviteFriendDialog({
  friend,
  onClose,
}: {
  friend: FriendEntry;
  onClose: () => void;
}) {
  const { active } = useGameSession();

  const [slug, setSlug] = useState(() => active?.slug ?? PLAYABLE[0]?.id ?? "");
  // Pré-rempli seulement si l'on invite dans la partie en cours.
  const [roomCode, setRoomCode] = useState(() => active?.roomCode ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const inOwnGame = active?.slug === slug;

  async function submit() {
    setPending(true);
    setError("");
    const result = await sendGameInvitation(friend.id, slug, roomCode.trim() || null);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Le push fait sonner le telephone de l'ami ; l'invitation elle-meme est
    // deja en base et l'attendra meme s'il a refuse les notifications.
    if (result.data) {
      void requestPushDelivery({ type: "game_invitation", invitationId: result.data });
    }
    setSent(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Inviter ${friend.username} à jouer`}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-void/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_48px_rgba(0,0,0,0.6)]">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-text">
              Inviter {friend.username}
            </p>
            <p className="font-body text-[11px] text-text-faint">
              {friend.presence === "offline"
                ? "Hors ligne — l'invitation l'attendra à sa prochaine connexion."
                : "En ligne — il recevra l'invitation tout de suite."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1 text-text-faint hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {sent ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="font-body text-sm text-text-dim">
              Invitation envoyée. Elle est valable 15 minutes.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2 font-display text-sm font-semibold text-void"
            >
              Fermer
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
                Jeu
              </span>
              <select
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  // Le salon appartient au jeu : changer de jeu l'invalide.
                  setRoomCode(active?.slug === event.target.value ? (active?.roomCode ?? "") : "");
                }}
                className="w-full rounded-lg border border-border-soft bg-void px-3 py-2.5 font-body text-base text-text focus:border-cyan/50 focus:outline-none sm:text-sm"
              >
                {PLAYABLE.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                    {active?.slug === game.id ? " — ta partie en cours" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
                Code de salon (facultatif)
              </span>
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
                maxLength={32}
                placeholder={inOwnGame ? "Ta partie en cours" : "Laisse vide pour inviter sur le jeu"}
                className="w-full rounded-lg border border-border-soft bg-void px-3 py-2.5 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none sm:text-sm"
              />
              <span className="font-body text-[11px] text-text-faint">
                Sans code, l&apos;invitation ouvre simplement le jeu.
              </span>
            </label>

            {error && <p className="font-body text-xs text-violet-soft">{error}</p>}

            <button
              type="button"
              disabled={pending || !slug}
              onClick={submit}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void disabled:opacity-50"
            >
              <Gamepad2 className="h-4 w-4" />
              {pending ? "Envoi…" : "Envoyer l'invitation"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
