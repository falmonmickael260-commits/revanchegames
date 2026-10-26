"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useDirectMessages } from "@/lib/use-direct-messages";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { PresenceDot, presenceLabel } from "./PresenceDot";
import type { ChatIdentity } from "@/lib/chat-shared";
import type { FriendEntry } from "@/lib/social/types";

/**
 * La conversation privée avec un ami, ouverte depuis le bouton « Chat » de la
 * liste d'amis.
 *
 * Même panneau, mêmes composants d'affichage (<ChatMessageList />,
 * <ChatComposer />) que le chat général et le chat flottant — seule la source
 * des messages change (voir `useDirectMessages`). Pas de nouvelle mécanique
 * de défilement ou de clavier à maintenir en double.
 */
export function DirectMessageDialog({
  me,
  friend,
  onClose,
}: {
  me: ChatIdentity;
  friend: FriendEntry;
  onClose: () => void;
}) {
  const keyboardInset = useKeyboardInset();
  // Mémoïsé sur les seules valeurs primitives : sans ça, cet objet littéral
  // changerait d'identité à chaque rendu (la présence de l'ami se
  // rafraîchit en continu), et `useDirectMessages` relancerait son
  // chargement d'historique en boucle au lieu de se stabiliser une fois.
  const other = useMemo(
    () => ({ id: friend.id, username: friend.username, avatarUrl: friend.avatarUrl }),
    [friend.id, friend.username, friend.avatarUrl],
  );
  const { messages, loading, sending, error, send, markRead } = useDirectMessages({ me, other });

  // Lu au fil de l'eau pendant que la conversation est ouverte — comme le
  // chat flottant marque le salon général comme lu à l'ouverture.
  useEffect(() => {
    markRead();
  }, [markRead, messages.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Conversation avec ${friend.username}`}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-void/70 p-0 backdrop-blur-sm sm:items-center sm:p-3"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex w-full flex-col overflow-hidden border border-border bg-surface shadow-[0_12px_48px_rgba(0,0,0,0.6)] sm:w-[400px] sm:rounded-2xl"
        style={{
          height: `calc(min(85dvh, 640px) - ${keyboardInset}px)`,
          marginBottom: keyboardInset,
        }}
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-border-soft px-3 py-2.5">
          <Avatar username={friend.username} avatarUrl={friend.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-text">{friend.username}</p>
            <p className="flex items-center gap-1.5 font-body text-[11px] text-text-faint">
              <PresenceDot status={friend.presence} />
              {presenceLabel(friend.presence)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la conversation"
            className="shrink-0 rounded-lg p-1.5 text-text-faint transition-colors hover:bg-surface-raised hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <ChatMessageList messages={messages} me={me} loading={loading} />
        <ChatComposer me={me} sending={sending} error={error} onSend={send} />
      </section>
    </div>
  );
}
