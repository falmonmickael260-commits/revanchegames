"use client";

import { ChatMessageList } from "./ChatMessageList";
import { ChatComposer } from "./ChatComposer";
import { useChatFeed } from "@/lib/use-chat-feed";
import type { ChatMessage, ChatIdentity } from "@/lib/chat-shared";

export type { ChatMessage } from "@/lib/chat-shared";

/**
 * Le salon de la page /chat.
 *
 * Toute la mécanique (historique, temps réel, envoi) vit désormais dans
 * `useChatFeed`, et l'affichage dans <ChatMessageList> / <ChatComposer> —
 * partagés avec le chat flottant de l'écran de jeu, pour que les deux ne
 * puissent pas diverger.
 *
 * L'historique initial reste rendu côté serveur par la page et transmis en
 * `seed` : la première peinture affiche déjà les messages, sans attendre une
 * requête côté navigateur.
 */
export function ChatRoom({
  initialMessages,
  me,
}: {
  initialMessages: ChatMessage[];
  me: ChatIdentity | null;
}) {
  const { messages, sending, error, send } = useChatFeed({
    seed: initialMessages,
    me,
    channelKey: "chat_messages",
  });

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface">
      <ChatMessageList messages={messages} me={me} />
      <ChatComposer me={me} sending={sending} error={error} onSend={send} />
    </div>
  );
}
