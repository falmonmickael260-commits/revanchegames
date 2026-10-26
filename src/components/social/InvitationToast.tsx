"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "./SocialProvider";
import { respondToGameInvitation } from "@/lib/social/api";
import { GAMES } from "@/data/games";

/**
 * L'invitation reçue, affichée par-dessus tout — y compris pendant une partie.
 *
 * C'est la raison d'être de ce composant plutôt que du seul centre de
 * notifications : sur /play/<slug>, l'en-tête de la plateforme (et donc la
 * cloche) est masqué pour rendre la place au jeu. Une invitation est
 * périssable, elle ne peut pas attendre que le joueur sorte de sa partie.
 *
 * Accepter ne coupe jamais la partie en cours de force : on navigue vers le
 * jeu invité, et c'est le changement de salon qui, lui seul, recharge le jeu
 * (voir GameSessionProvider).
 */
export function InvitationToast() {
  const { invitations, refresh } = useSocial();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // L'erreur est rattachée à l'invitation qui l'a produite : elle disparaît
  // d'elle-même quand on passe à une autre, sans effet de synchronisation.
  const [failure, setFailure] = useState<{ invitationId: string; message: string } | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const invitation = invitations.find((item) => !dismissed.includes(item.id));
  const error = failure && invitation && failure.invitationId === invitation.id ? failure.message : "";

  if (!invitation) return null;

  const game = GAMES.find((item) => item.id === invitation.gameSlug);
  const gameLabel = game?.name ?? invitation.gameSlug;
  const playable = game?.enabled === true;

  async function respond(accept: boolean) {
    const id = invitation!.id;
    setBusy(true);
    setFailure(null);
    const result = await respondToGameInvitation(id, accept);
    setBusy(false);

    if (!result.ok) {
      // Salon complet, invitation expirée entre-temps, déjà traitée ailleurs :
      // la fonction SQL l'a refusée, on affiche sa raison telle quelle.
      setFailure({ invitationId: id, message: result.error });
      await refresh();
      return;
    }

    await refresh();

    if (accept && result.data?.status === "accepted") {
      const slug = result.data.game_slug;
      const room = result.data.room_code;
      router.push(`/play/${slug}${room ? `?room=${encodeURIComponent(room)}` : ""}`);
    }
  }

  return (
    <section
      aria-label="Invitation à jouer"
      // z-[55] : au-dessus du chat flottant (z-50) et de la scène de jeu,
      // sous le grain décoratif. Centré en haut pour ne pas recouvrir les
      // commandes de jeu, qui sont presque toujours en bas.
      className="fixed left-2 right-2 z-[55] mx-auto flex max-w-sm flex-col gap-2.5 rounded-2xl border border-cyan/40 bg-surface/98 p-3 shadow-[0_12px_48px_rgba(0,0,0,0.6)] backdrop-blur-lg sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      style={{ top: "calc(var(--rg-game-bar-h) + 0.5rem)" }}
    >
      <div className="flex items-start gap-2.5">
        <Avatar
          username={invitation.fromUsername}
          avatarUrl={invitation.fromAvatarUrl}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm text-text" style={{ overflowWrap: "anywhere" }}>
            <strong className="font-display font-semibold">{invitation.fromUsername}</strong>{" "}
            t&apos;invite à jouer à{" "}
            <strong className="font-display font-semibold text-cyan">{gameLabel}</strong>.
          </p>
          {invitation.roomCode && (
            <p className="mt-0.5 font-body text-[11px] text-text-faint">
              Salon {invitation.roomCode}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed((list) => [...list, invitation.id])}
          aria-label="Masquer cette invitation"
          className="shrink-0 rounded-lg p-1 text-text-faint hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="font-body text-xs text-violet-soft">{error}</p>}

      {!playable && (
        <p className="font-body text-xs text-amber">
          Ce jeu n&apos;est pas encore disponible sur la plateforme.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !playable}
          onClick={() => respond(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-3 py-2 font-display text-xs font-semibold text-void disabled:opacity-50"
        >
          <Gamepad2 className="h-3.5 w-3.5" />
          {busy ? "…" : "Rejoindre"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => respond(false)}
          className="rounded-lg border border-border-soft px-3 py-2 font-display text-xs font-semibold text-text-dim disabled:opacity-50"
        >
          Refuser
        </button>
      </div>
    </section>
  );
}
