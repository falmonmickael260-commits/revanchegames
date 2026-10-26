"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, Gamepad2, UserPlus, UserCheck, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "./SocialProvider";
import { respondToFriendRequest } from "@/lib/social/api";
import { requestPushDelivery } from "@/lib/push-client";
import { GAMES } from "@/data/games";
import type { PlatformNotification } from "@/lib/social/types";

const BADGE_CAP = 99;

function gameName(slug: string | null): string | null {
  if (!slug) return null;
  return GAMES.find((game) => game.id === slug)?.name ?? slug;
}

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

function describe(notification: PlatformNotification): { icon: typeof Bell; text: string } {
  const who = notification.actorUsername ?? "Un joueur";
  const game = gameName(notification.gameSlug);
  switch (notification.kind) {
    case "friend_request":
      return { icon: UserPlus, text: `${who} veut devenir ton ami.` };
    case "friend_accepted":
      return { icon: UserCheck, text: `${who} a accepté ta demande d'ami.` };
    case "game_invitation":
      return { icon: Gamepad2, text: `${who} t'invite à jouer${game ? ` à ${game}` : ""}.` };
    case "invitation_accepted":
      return { icon: Check, text: `${who} a accepté ton invitation${game ? ` à ${game}` : ""}.` };
    case "invitation_declined":
      return { icon: X, text: `${who} a refusé ton invitation${game ? ` à ${game}` : ""}.` };
  }
}

/**
 * Le centre de notifications de la plateforme.
 *
 * Volontairement indépendant des notifications push : il affiche les lignes de
 * la table `notifications`, donc il fonctionne même si le navigateur refuse
 * les notifications système, et une invitation reçue hors ligne est toujours
 * là à la reconnexion. Le push ne fait que prévenir plus tôt.
 */
export function NotificationCenter() {
  const { me, notifications, unreadCount, incomingRequests, markAllRead, refresh } = useSocial();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Marquer comme lu à l'ouverture, pas à la réception : le compteur doit
  // refléter ce que le joueur n'a pas encore vu.
  useEffect(() => {
    if (open) void markAllRead();
  }, [open, markAllRead]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    // `capture` : on veut fermer même si un élément interne stoppe la propagation.
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    };
  }, [open]);

  if (!me) return null;

  async function respond(friendshipId: string, accept: boolean) {
    setBusyId(friendshipId);
    setError("");
    const result = await respondToFriendRequest(friendshipId, accept);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (accept) {
      void requestPushDelivery({ type: "friend_accepted", friendshipId });
    }
    await refresh();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unreadCount > 0
            ? `Notifications — ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
            : "Notifications"
        }
        aria-expanded={open}
        className="relative rounded-lg p-2 text-text-faint transition-colors hover:bg-surface hover:text-text-dim"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-cyan to-violet px-1 py-0.5 font-display text-[10px] font-bold leading-none text-void">
            {unreadCount > BADGE_CAP ? `${BADGE_CAP}+` : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Notifications"
          className="fixed left-2 right-2 top-[calc(var(--rg-header-h)+0.5rem)] z-50 flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-border bg-surface/98 shadow-[0_12px_48px_rgba(0,0,0,0.6)] backdrop-blur-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px]"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border-soft px-3 py-2.5">
            <p className="font-display text-sm font-semibold text-text">Notifications</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="rounded-lg p-1 text-text-faint hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {error && (
            <p className="shrink-0 border-b border-border-soft bg-violet/10 px-3 py-2 font-body text-xs text-violet-soft">
              {error}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <p className="px-3 py-10 text-center font-body text-sm text-text-faint">
                Aucune notification pour l&apos;instant.
              </p>
            ) : (
              <ul className="divide-y divide-border-soft">
                {notifications.map((notification) => {
                  const { icon: Icon, text } = describe(notification);
                  // Une demande d'ami se traite directement depuis ici, mais
                  // seulement si elle est encore en attente — sinon le bouton
                  // mentirait sur ce qu'il peut faire.
                  const request = incomingRequests.find((r) => r.id === notification.actorId);
                  const actionable = notification.kind === "friend_request" && request;

                  return (
                    <li
                      key={notification.id}
                      className={`flex gap-2.5 px-3 py-2.5 ${
                        notification.readAt === null ? "bg-cyan/[0.04]" : ""
                      }`}
                    >
                      {notification.actorUsername ? (
                        <Avatar
                          username={notification.actorUsername}
                          avatarUrl={notification.actorAvatarUrl}
                          size="sm"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised">
                          <Icon className="h-4 w-4 text-text-faint" />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="font-body text-sm text-text" style={{ overflowWrap: "anywhere" }}>
                          {text}
                        </p>
                        <p className="mt-0.5 font-body text-[11px] text-text-faint">
                          {relativeTime(notification.createdAt)}
                        </p>

                        {actionable && (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={busyId === request.friendshipId}
                              onClick={() => respond(request.friendshipId, true)}
                              className="rounded-lg bg-gradient-to-r from-cyan to-violet px-2.5 py-1 font-display text-xs font-semibold text-void disabled:opacity-50"
                            >
                              Accepter
                            </button>
                            <button
                              type="button"
                              disabled={busyId === request.friendshipId}
                              onClick={() => respond(request.friendshipId, false)}
                              className="rounded-lg border border-border-soft px-2.5 py-1 font-display text-xs font-semibold text-text-dim disabled:opacity-50"
                            >
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="shrink-0 border-t border-border-soft px-3 py-2">
            <Link
              href="/friends"
              onClick={() => setOpen(false)}
              className="font-display text-xs font-semibold text-cyan hover:text-cyan-soft"
            >
              Voir mes amis
            </Link>
          </footer>
        </section>
      )}
    </div>
  );
}
