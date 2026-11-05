"use client";

import Link from "next/link";
import { useEffect, useMemo, type CSSProperties } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useDirectMessages } from "@/lib/use-direct-messages";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { PresenceDot, presenceLabel } from "./PresenceDot";
import type { ChatIdentity } from "@/lib/chat-shared";
import type { FriendEntry } from "@/lib/social/types";
import { PrivateGameInvitation } from './PrivateGameInvitation';
import { VoiceInvitation } from '@/components/voice/VoiceInvitation';
import { GiftLauncher } from '@/components/gifts/GiftLauncher';
import { GiftMessageAttachment } from '@/components/gifts/GiftMessageAttachment';
import { requestPushDelivery } from '@/lib/push-client';

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
      className="rg-direct-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="rg-direct-conversation"
        style={{ "--rg-keyboard-inset": `${keyboardInset}px` } as CSSProperties}
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-border-soft px-3 py-2.5">
          <Link href={`/profile/${friend.id}`} aria-label={`Profil de ${friend.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar username={friend.username} avatarUrl={friend.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-text">{friend.username}</p>
            <p className="flex items-center gap-1.5 font-body text-[11px] text-text-faint">
              <PresenceDot status={friend.presence} />
              {presenceLabel(friend.presence)}
            </p>
          </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la conversation"
            className="shrink-0 rounded-lg p-1.5 text-text-faint transition-colors hover:bg-surface-raised hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <ChatMessageList messages={messages} me={me} loading={loading}
          renderAttachment={(message, own) => message.giftBatchId ? <GiftMessageAttachment id={message.giftBatchId} own={own} animate={message.live} /> :
            message.invitationId ? <PrivateGameInvitation id={message.invitationId} own={own} onJoined={onClose} /> :
            message.voiceInvitation ? <VoiceInvitation id={message.id} roomId={message.voiceInvitation.roomId} expiresAt={message.voiceInvitation.expiresAt} own={own} onJoined={onClose} /> : null} />
        <ChatComposer me={me} sending={sending} error={error} onSend={send}
          leadingAction={<GiftLauncher meId={me.id} recipients={[{ id: friend.id, name: friend.username }]} context="dm"
            onSent={(_id, messageId) => { if (messageId) void requestPushDelivery({ type: "direct_message", messageId }); }} />} />
      </section>
    </div>
  );
}
