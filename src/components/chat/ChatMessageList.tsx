"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatChatTime, type ChatMessage, type ChatIdentity } from "@/lib/chat-shared";

/** Marge, en pixels, en dessous de laquelle on considère être « en bas ». */
const STICK_THRESHOLD = 72;

/**
 * La liste de messages, partagée par le salon /chat et le chat flottant.
 *
 * Défilement automatique conditionnel : on ne recolle en bas que si le joueur
 * y était déjà. S'il est remonté dans l'historique, un message qui arrive ne
 * lui arrache plus sa lecture — il voit à la place un bouton « nouveaux
 * messages » pour redescendre quand il le décide.
 */
export function ChatMessageList({
  messages,
  me,
  loading,
  compact = false,
  unreadFrom,
}: {
  messages: ChatMessage[];
  me: ChatIdentity | null;
  loading?: boolean;
  compact?: boolean;
  /** Horodatage ISO du dernier message lu : trace un repere avant le premier
   * message plus recent, pour qu'on voie ou on s'etait arrete. */
  unreadFrom?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  // Doublé en ref : l'effet de mise en page ci-dessous doit connaître la
  // position courante sans se relancer quand elle change.
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  // Nombre de messages déjà vus par le joueur. Le compteur de messages
  // manqués en est *dérivé* (`messages.length - seenCount`) au lieu d'être
  // incrémenté depuis un effet : pas d'état à resynchroniser, donc pas de
  // rendu en cascade.
  const [seenCount, setSeenCount] = useState(0);
  const missed = Math.max(0, messages.length - seenCount);

  // useLayoutEffect : on repositionne avant que le navigateur ne peigne, pour
  // qu'aucun saut de défilement ne soit visible. Cet effet ne fait que du DOM
  // — déplacer le défilement déclenche un événement `scroll`, et c'est ce
  // gestionnaire, plus bas, qui met l'état à jour.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (atBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const count = messages.length;

    function handleScroll() {
      if (!list) return;
      const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
      const bottom = distance <= STICK_THRESHOLD;

      // Tout est considéré comme vu si on est en bas — mais aussi si on vient
      // tout juste de le quitter : au moment où le joueur remonte dans
      // l'historique, il a bien lu ce qui était affiché jusque-là. Sans ce
      // second cas, remonter afficherait aussitôt « N nouveaux messages »
      // pour des messages déjà sous ses yeux.
      if (bottom || atBottomRef.current) setSeenCount(count);

      atBottomRef.current = bottom;
      setAtBottom(bottom);
    }

    list.addEventListener("scroll", handleScroll, { passive: true });
    return () => list.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  // Index du premier message non lu — uniquement ceux des autres joueurs :
  // ses propres messages ne sont jamais "non lus".
  const firstUnreadIndex =
    unreadFrom === undefined
      ? -1
      : messages.findIndex((m) => m.userId !== me?.id && m.createdAt > unreadFrom);

  function scrollToBottom() {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    atBottomRef.current = true;
    setAtBottom(true);
    setSeenCount(messages.length);
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={listRef}
        className={`h-full overflow-y-auto overscroll-contain ${
          compact ? "px-2.5 py-3" : "px-3 py-3 sm:px-4 sm:py-4"
        }`}
      >
        {loading ? (
          <p className="py-10 text-center font-body text-sm text-text-faint">
            Chargement des messages…
          </p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center font-body text-sm text-text-faint">
            Aucun message pour l&apos;instant — sois le premier à dire bonjour !
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message, index) => {
              const own = me?.id === message.userId;
              return (
                <div key={message.id} className="contents">
                {index === firstUnreadIndex && (
                  <div className="flex items-center gap-2 py-0.5" aria-label="Nouveaux messages">
                    <span className="h-px flex-1 bg-cyan/30" />
                    <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan">
                      Nouveaux messages
                    </span>
                    <span className="h-px flex-1 bg-cyan/30" />
                  </div>
                )}
                <div
                  className={`flex items-start gap-2 sm:gap-2.5 ${
                    own ? "flex-row-reverse text-right" : ""
                  }`}
                >
                  <Avatar username={message.username} avatarUrl={message.avatarUrl} size="sm" />
                  <div
                    className={`flex min-w-0 max-w-[82%] flex-col gap-0.5 sm:max-w-[75%] ${
                      own ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate font-display text-xs font-semibold text-text-dim">
                        {message.username}
                      </span>
                      <span className="shrink-0 font-body text-[0.7rem] text-text-faint">
                        {formatChatTime(message.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`min-w-0 break-words rounded-xl px-3 py-1.5 font-body text-sm text-text ${
                        own ? "bg-gradient-to-r from-cyan/20 to-violet/20" : "bg-surface-raised"
                      }`}
                      style={{ overflowWrap: "anywhere" }}
                    >
                      {message.body}
                    </p>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!atBottom && missed > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-cyan/40 bg-surface-raised/95 px-3 py-1.5 font-display text-xs font-semibold text-cyan shadow-lg backdrop-blur"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          {missed === 1 ? "1 nouveau message" : `${missed} nouveaux messages`}
        </button>
      )}
    </div>
  );
}
