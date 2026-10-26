"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Gamepad2,
  MessageCircle,
  Radio,
  Search,
  ShieldOff,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/library/EmptyState";
import { GAMES } from "@/data/games";
import { useSocial } from "./SocialProvider";
import { PresenceDot, presenceLabel } from "./PresenceDot";
import { InviteFriendDialog } from "./InviteFriendDialog";
import { DirectMessageDialog } from "./DirectMessageDialog";
import {
  blockPlayer,
  inviteToPlatform,
  removeFriend,
  respondToFriendRequest,
  searchPlayers,
  sendFriendRequest,
  unblockPlayer,
} from "@/lib/social/api";
import { requestPushDelivery } from "@/lib/push-client";
import type { FriendEntry, SearchResult } from "@/lib/social/types";

const SEARCH_DEBOUNCE_MS = 280;

function gameName(slug: string | null): string | null {
  if (!slug) return null;
  return GAMES.find((game) => game.id === slug)?.name ?? slug;
}

/**
 * La page Amis : rechercher, demander, accepter, inviter, retirer, bloquer.
 *
 * Une seule liste d'amis pour toute la plateforme — pas une par jeu. Les
 * actions passent toutes par les fonctions SQL `security definer` : ce
 * composant ne fait qu'afficher et appeler.
 */
export function FriendsView() {
  const {
    me,
    ready,
    friends,
    incomingRequests,
    outgoingRequests,
    blocked,
    dmUnread,
    refresh,
  } = useSocial();

  const [query, setQuery] = useState("");
  // Dernier jeu de résultats reçu, avec la requête qui l'a produit : afficher
  // les deux ensemble évite de montrer des résultats périmés quand on efface,
  // et dispense de remettre l'état à zéro depuis un effet.
  const [found, setFound] = useState<{ needle: string; items: SearchResult[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [inviting, setInviting] = useState<FriendEntry | null>(null);
  const [chatting, setChatting] = useState<FriendEntry | null>(null);
  // Amis à qui on vient de faire signe : désactive le bouton localement, pour
  // ne pas attendre une erreur serveur avant de refléter la limite de
  // fréquence (deux heures, voir invite_to_platform).
  const [pinged, setPinged] = useState<Set<string>>(new Set());

  const needle = query.trim();
  const longEnough = needle.length >= 2;
  const results = longEnough && found?.needle === needle ? found.items : [];

  // Recherche différée : on n'interroge pas la base à chaque frappe. Tout le
  // `setState` vit dans le `setTimeout`, donc hors du corps de l'effet.
  useEffect(() => {
    if (needle.length < 2) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await searchPlayers(needle);
      setSearching(false);
      if (!result.ok) {
        setError(result.error);
        setFound({ needle, items: [] });
        return;
      }
      setFound({ needle, items: result.data });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [needle]);

  async function run(id: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(id);
    setError("");
    const result = await action();
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "Action impossible.");
      return;
    }
    await refresh();
    // La recherche affiche l'état de la relation : il vient de changer.
    if (longEnough) {
      const again = await searchPlayers(needle);
      if (again.ok) setFound({ needle, items: again.data });
    }
  }

  if (!ready) {
    return (
      <Shell>
        <div className="h-32 animate-pulse rounded-2xl border border-border-soft bg-surface" />
      </Shell>
    );
  }

  if (!me) {
    return (
      <Shell>
        <EmptyState
          icon={Users}
          title="Connecte-toi pour retrouver tes amis"
          message="La liste d'amis, la présence en ligne et les invitations sont liées à ton compte Revanche Games — le même sur les cinq jeux."
          action={
            <div className="flex gap-2">
              <Link
                href="/sign-up"
                className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2 font-display text-sm font-semibold text-void"
              >
                Créer un compte
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border border-border-soft px-4 py-2 font-display text-sm font-semibold text-text-dim"
              >
                Se connecter
              </Link>
            </div>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell>
      {error && (
        <p className="rounded-lg border border-violet/30 bg-violet/10 px-3 py-2 font-body text-sm text-violet-soft">
          {error}
        </p>
      )}

      {/* ---- Recherche ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
          Ajouter un ami
        </h2>
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pseudonyme ou identifiant RG-…"
            aria-label="Chercher un joueur par pseudonyme ou par son identifiant fixe"
            className="w-full rounded-full border border-border-soft bg-surface py-2.5 pl-10 pr-4 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20 sm:text-sm"
          />
        </div>

        {needle.length === 1 && (
          <p className="font-body text-xs text-text-faint">Deux caractères minimum.</p>
        )}
        {longEnough && searching && (
          <p className="font-body text-xs text-text-faint">Recherche…</p>
        )}
        {longEnough && !searching && found?.needle === needle && results.length === 0 && (
          <p className="font-body text-xs text-text-faint">Aucun joueur à ce pseudonyme.</p>
        )}

        {results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((result) => (
              <li
                key={result.id}
                className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface px-3 py-2.5"
              >
                <Avatar username={result.username} avatarUrl={result.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text">
                  {result.username}
                </span>

                {result.relationship === "friend" && (
                  <span className="shrink-0 font-body text-xs text-text-faint">Déjà ami</span>
                )}
                {result.relationship === "request_sent" && (
                  <span className="shrink-0 font-body text-xs text-text-faint">Demande envoyée</span>
                )}
                {result.relationship === "request_received" && (
                  <span className="shrink-0 font-body text-xs text-cyan">T&apos;a demandé</span>
                )}
                {result.relationship === "none" &&
                  (result.acceptsRequests ? (
                    <button
                      type="button"
                      disabled={busyId === result.id}
                      onClick={() =>
                        run(result.id, async () => {
                          const sent = await sendFriendRequest(result.id);
                          // Le push est un supplement : la notification dans
                          // la plateforme est deja enregistree par la fonction
                          // SQL, donc on n'attend pas son resultat.
                          if (sent.ok && sent.data) {
                            void requestPushDelivery({
                              type: "friend_request",
                              friendshipId: sent.data,
                            });
                          }
                          return sent;
                        })
                      }
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-3 py-1.5 font-display text-xs font-semibold text-void disabled:opacity-50"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Ajouter
                    </button>
                  ) : (
                    <span className="shrink-0 font-body text-xs text-text-faint">
                      N&apos;accepte pas les demandes
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Demandes reçues ---- */}
      {incomingRequests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
            Demandes reçues ({incomingRequests.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {incomingRequests.map((request) => (
              <li
                key={request.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-cyan/25 bg-surface px-3 py-2.5"
              >
                <Avatar username={request.username} avatarUrl={request.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text">
                  {request.username}
                </span>
                <button
                  type="button"
                  disabled={busyId === request.friendshipId}
                  onClick={() =>
                    run(request.friendshipId, async () => {
                      const answered = await respondToFriendRequest(request.friendshipId, true);
                      if (answered.ok) {
                        void requestPushDelivery({
                          type: "friend_accepted",
                          friendshipId: request.friendshipId,
                        });
                      }
                      return answered;
                    })
                  }
                  aria-label={`Accepter la demande de ${request.username}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-cyan to-violet text-void disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busyId === request.friendshipId}
                  onClick={() =>
                    run(request.friendshipId, () =>
                      respondToFriendRequest(request.friendshipId, false),
                    )
                  }
                  aria-label={`Refuser la demande de ${request.username}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-soft text-text-dim disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Demandes envoyées ---- */}
      {outgoingRequests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
            Demandes envoyées ({outgoingRequests.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {outgoingRequests.map((request) => (
              <li
                key={request.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface px-3 py-2.5"
              >
                <Avatar username={request.username} avatarUrl={request.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate font-body text-sm text-text-dim">
                  {request.username} — en attente
                </span>
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => run(request.id, () => removeFriend(request.id))}
                  className="shrink-0 rounded-lg border border-border-soft px-2.5 py-1 font-display text-xs font-semibold text-text-dim disabled:opacity-50"
                >
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Liste d'amis ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
          Mes amis ({friends.length})
        </h2>

        {friends.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Pas encore d'amis"
            message="Cherche un pseudonyme ci-dessus pour envoyer ta première demande. Tes amis seront les mêmes sur tous les jeux de la plateforme."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((friend) => {
              const playing = gameName(friend.gameSlug);
              return (
                <li
                  key={friend.friendshipId}
                  className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface px-3 py-2.5"
                >
                  <Link href={`/profile/${friend.id}`} className="shrink-0">
                    <Avatar username={friend.username} avatarUrl={friend.avatarUrl} size="sm" />
                  </Link>

                  <Link href={`/profile/${friend.id}`} className="min-w-0 flex-1 group">
                    <p className="truncate font-display text-sm font-semibold text-text group-hover:text-cyan">
                      {friend.username}
                    </p>
                    <p className="flex items-center gap-1.5 font-body text-[11px] text-text-faint">
                      <PresenceDot status={friend.presence} />
                      {playing ? `En partie — ${playing}` : presenceLabel(friend.presence)}
                    </p>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setChatting(friend)}
                    aria-label={
                      dmUnread.get(friend.id)
                        ? `Discuter avec ${friend.username} — ${dmUnread.get(friend.id)} message${(dmUnread.get(friend.id) ?? 0) > 1 ? "s" : ""} non lu${(dmUnread.get(friend.id) ?? 0) > 1 ? "s" : ""}`
                        : `Discuter avec ${friend.username}`
                    }
                    className="relative flex shrink-0 items-center gap-1.5 rounded-lg border border-border-soft px-2.5 py-1.5 font-display text-xs font-semibold text-text-dim transition-colors hover:border-border hover:text-text"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Chat</span>
                    {Boolean(dmUnread.get(friend.id)) && (
                      <span className="absolute -right-1 -top-1 flex min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-cyan to-violet px-1 py-0.5 font-display text-[9px] font-bold leading-none text-void">
                        {dmUnread.get(friend.id)}
                      </span>
                    )}
                  </button>

                  {friend.presence === "offline" && (
                    <button
                      type="button"
                      disabled={pinged.has(friend.id)}
                      onClick={async () => {
                        setPinged((set) => new Set(set).add(friend.id));
                        const result = await inviteToPlatform(friend.id);
                        if (result.ok) {
                          void requestPushDelivery({ type: "platform_invite", toUserId: friend.id });
                        } else {
                          // Limite de fréquence ou relation entre-temps rompue :
                          // on ne bloque pas définitivement le bouton pour une
                          // tentative qui n'a pas abouti.
                          setPinged((set) => {
                            const next = new Set(set);
                            next.delete(friend.id);
                            return next;
                          });
                          setError(result.error);
                        }
                      }}
                      aria-label={`Faire signe à ${friend.username} de nous rejoindre`}
                      title="Inviter à nous rejoindre sur Revanche Games"
                      className="flex shrink-0 items-center gap-1.5 rounded-lg p-1.5 text-text-faint transition-colors hover:bg-surface-raised hover:text-cyan disabled:opacity-40"
                    >
                      <Radio className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setInviting(friend)}
                    aria-label={`Inviter ${friend.username} à jouer`}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-2.5 py-1.5 font-display text-xs font-semibold text-void"
                  >
                    <Gamepad2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Inviter</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyId === friend.id}
                    onClick={() => run(friend.id, () => removeFriend(friend.id))}
                    aria-label={`Retirer ${friend.username} de mes amis`}
                    className="shrink-0 rounded-lg p-1.5 text-text-faint transition-colors hover:bg-surface-raised hover:text-text-dim disabled:opacity-50"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={busyId === friend.id}
                    onClick={() => run(friend.id, () => blockPlayer(friend.id))}
                    aria-label={`Bloquer ${friend.username}`}
                    className="shrink-0 rounded-lg p-1.5 text-text-faint transition-colors hover:bg-violet/15 hover:text-violet-soft disabled:opacity-50"
                  >
                    <ShieldOff className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Bloqués ---- */}
      {blocked.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
            Joueurs bloqués ({blocked.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {blocked.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface px-3 py-2.5"
              >
                <Avatar username={player.username} avatarUrl={player.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate font-body text-sm text-text-dim">
                  {player.username}
                </span>
                <button
                  type="button"
                  disabled={busyId === player.id}
                  onClick={() => run(player.id, () => unblockPlayer(player.id))}
                  className="shrink-0 rounded-lg border border-border-soft px-2.5 py-1 font-display text-xs font-semibold text-text-dim disabled:opacity-50"
                >
                  Débloquer
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inviting && (
        <InviteFriendDialog friend={inviting} onClose={() => setInviting(null)} />
      )}

      {chatting && me && (
        <DirectMessageDialog me={me} friend={chatting} onClose={() => setChatting(null)} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Communauté"
        title="Amis"
        subtitle="Une seule liste d'amis pour tous les jeux de la plateforme."
      />
      {children}
    </div>
  );
}
