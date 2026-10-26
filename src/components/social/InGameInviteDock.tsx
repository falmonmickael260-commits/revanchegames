"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "./SocialProvider";
import { PresenceDot, presenceLabel } from "./PresenceDot";
import { sendGameInvitation } from "@/lib/social/api";
import { requestPushDelivery } from "@/lib/push-client";

/**
 * Inviter un ami dans la partie en cours, sans quitter l'écran de jeu.
 *
 * Volontairement distinct de <InviteFriendDialog /> (ouvert depuis /friends) :
 * là-bas, il faut encore choisir le jeu — ici, on y est déjà, donc chaque
 * ligne envoie directement l'invitation pour `gameSlug`/`roomCode`, sans
 * étape de sélection en trop.
 *
 * Calé à gauche, comme <ResumeGamePill /> (qui ne s'affiche jamais en même
 * temps — elle est masquée précisément sur l'écran de jeu) : le chat flottant
 * garde le coin droit.
 */
export function InGameInviteDock({
  gameSlug,
  roomCode,
}: {
  gameSlug: string;
  roomCode: string | null;
}) {
  const { friends } = useSocial();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  // Rien à proposer sans amis : pas la peine d'occuper un coin de l'écran.
  if (friends.length === 0) return null;

  async function invite(friendId: string) {
    setBusyId(friendId);
    setError("");
    const result = await sendGameInvitation(friendId, gameSlug, roomCode);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data) {
      void requestPushDelivery({ type: "game_invitation", invitationId: result.data });
    }
    setSentTo((set) => new Set(set).add(friendId));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Fermer inviter un ami" : "Inviter un ami dans cette partie"}
        aria-expanded={open}
        className={`fixed left-3 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-raised/90 text-text shadow-[0_6px_24px_rgba(0,0,0,0.45)] backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50 sm:left-4 ${
          open ? "opacity-100" : "opacity-75"
        }`}
        style={{ bottom: "calc(0.75rem + var(--rg-safe-bottom))" }}
      >
        {open ? <X className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
      </button>

      {open && (
        <section
          aria-label="Inviter un ami dans cette partie"
          className="fixed left-2 right-2 z-50 flex max-h-[60dvh] flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-[0_12px_48px_rgba(0,0,0,0.6)] backdrop-blur-lg sm:left-4 sm:right-auto sm:w-[320px]"
          style={{ bottom: "calc(3.75rem + 0.75rem + var(--rg-safe-bottom))" }}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border-soft px-3 py-2.5">
            <p className="font-display text-sm font-semibold text-text">Inviter dans la partie</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-surface-raised hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {error && (
            <p className="shrink-0 border-b border-border-soft bg-violet/10 px-3 py-2 font-body text-xs text-violet-soft">
              {error}
            </p>
          )}

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            {friends.map((friend) => {
              const sent = sentTo.has(friend.id);
              return (
                <li
                  key={friend.id}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-raised"
                >
                  <Avatar username={friend.username} avatarUrl={friend.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold text-text">
                      {friend.username}
                    </p>
                    <p className="flex items-center gap-1.5 font-body text-[11px] text-text-faint">
                      <PresenceDot status={friend.presence} />
                      {presenceLabel(friend.presence)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === friend.id || sent}
                    onClick={() => invite(friend.id)}
                    className="shrink-0 rounded-lg bg-gradient-to-r from-cyan to-violet px-2.5 py-1.5 font-display text-xs font-semibold text-void disabled:opacity-50"
                  >
                    {sent ? "Envoyée" : busyId === friend.id ? "…" : "Inviter"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
