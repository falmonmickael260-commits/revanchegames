"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { ChatMessageList } from "./ChatMessageList";
import { ChatComposer } from "./ChatComposer";
import { useChatFeed, useChatIdentity } from "@/lib/use-chat-feed";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { createLocalStore } from "@/lib/create-local-store";

/**
 * Horodatage ISO du dernier message consulté.
 *
 * Stocké via le même petit magasin localStorage que les favoris et le profil
 * (`rg:` + clé), pour que l'état de lecture suive les règles de persistance
 * déjà en place sur la plateforme plutôt que d'en inventer une autre.
 */
const lastReadStore = createLocalStore<string>("chat-last-read", "");

/** Au-delà, le badge affiche « 99+ » plutôt que de s'élargir sans fin. */
const BADGE_CAP = 99;

/**
 * Le chat flottant, disponible pendant toute la partie.
 *
 * Monté dans la coquille (et non dans la page de jeu) pour deux raisons :
 * il reste ouvert quand le joueur passe d'une section à l'autre, et son
 * compteur de non-lus continue de monter pendant qu'il est fermé.
 *
 * Il réutilise strictement le salon général existant : même table, même
 * abonnement temps réel, même composants d'affichage que la page /chat — un
 * message envoyé ici apparaît là-bas, et réciproquement.
 */
export function ChatDock({
  suspended = false,
  onGameScreen = false,
}: {
  suspended?: boolean;
  /** Vrai sur /play/<slug> : la barre d'onglets du bas y est masquee, le
   * bouton peut descendre jusqu'a la zone de securite. Ailleurs, il doit se
   * placer au-dessus de la barre pour ne rien recouvrir. */
  onGameScreen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [lastRead, setLastRead] = lastReadStore.useValue();
  const { me } = useChatIdentity();
  const keyboardInset = useKeyboardInset();

  const fabBottom = onGameScreen
    ? "calc(0.75rem + var(--rg-safe-bottom))"
    : "calc(0.75rem + var(--rg-bottom-nav-h))";

  // `suspended` est vrai quand la page /chat est à l'écran : elle tient déjà
  // son propre abonnement sur le même salon, inutile d'en ouvrir un second.
  const { messages, loading, sending, error, send } = useChatFeed({
    me,
    channelKey: "chat_messages_dock",
    enabled: !suspended,
  });

  const latestAt = messages.length > 0 ? messages[messages.length - 1].createdAt : "";

  const unread = useMemo(
    () => messages.filter((m) => m.userId !== me?.id && m.createdAt > lastRead).length,
    [messages, me?.id, lastRead],
  );

  // Le repère « nouveaux messages » est figé à l'ouverture : il doit rester là
  // où le joueur s'était arrêté, et ne pas descendre pendant qu'il lit.
  const [unreadMarker, setUnreadMarker] = useState<string | undefined>(undefined);

  const markRead = useCallback(() => {
    if (latestAt && latestAt > lastRead) setLastRead(latestAt);
  }, [latestAt, lastRead, setLastRead]);

  // Panneau ouvert : tout ce qui arrive est considéré comme lu au fil de l'eau.
  useEffect(() => {
    if (open) markRead();
  }, [open, markRead]);

  // Si la page /chat prend le relais, ce qui s'y affiche est lu.
  useEffect(() => {
    if (suspended) markRead();
  }, [suspended, markRead]);

  function toggle() {
    setOpen((wasOpen) => {
      if (!wasOpen) setUnreadMarker(lastRead || undefined);
      return !wasOpen;
    });
  }

  // Échap ferme le panneau — on revient au jeu sans chercher la croix.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (suspended) return null;

  return (
    <>
      {/* Bouton flottant. Calé en bas à droite, au-dessus de la zone de
          sécurité ; translucide au repos pour ne pas peser sur l'image du jeu,
          pleinement opaque au survol et dès qu'un message attend. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unread > 0
            ? `Ouvrir le chat — ${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}`
            : open
              ? "Fermer le chat"
              : "Ouvrir le chat"
        }
        aria-expanded={open}
        className={`fixed right-3 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-raised/90 text-text shadow-[0_6px_24px_rgba(0,0,0,0.45)] backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50 sm:right-4 ${
          open || unread > 0 ? "opacity-100" : "opacity-75"
        }`}
        style={{ bottom: fabBottom }}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}

        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-cyan to-violet px-1 py-0.5 font-display text-[10px] font-bold leading-none text-void">
            {unread > BADGE_CAP ? `${BADGE_CAP}+` : unread}
          </span>
        )}
      </button>

      {/* Panneau. Sur mobile il occupe presque tout l'écran ; à partir de sm
          il devient un panneau d'angle qui laisse le jeu visible à côté. */}
      {open && (
        <section
          aria-label="Chat général"
          className="fixed left-2 right-2 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-[0_12px_48px_rgba(0,0,0,0.6)] backdrop-blur-lg sm:left-auto sm:right-4 sm:w-[360px]"
          style={{
            // Le décalage par le clavier virtuel garde la zone de saisie
            // visible pendant la frappe (cf. useKeyboardInset).
            bottom: `calc(3.75rem + ${fabBottom} + ${keyboardInset}px)`,
            maxHeight: `calc(100dvh - var(--rg-game-bar-h) - 5rem - ${keyboardInset}px)`,
            height: "min(70dvh, 520px)",
          }}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border-soft px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-text">Chat général</p>
              <p className="truncate font-body text-[11px] text-text-faint">
                Tous les joueurs, tous jeux confondus
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le chat et revenir au jeu"
              className="ml-2 shrink-0 rounded-lg p-1.5 text-text-faint transition-colors hover:bg-surface-raised hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <ChatMessageList
            messages={messages}
            me={me}
            loading={loading}
            compact
            unreadFrom={unreadMarker}
          />
          <ChatComposer me={me} sending={sending} error={error} onSend={send} compact />
        </section>
      )}
    </>
  );
}
