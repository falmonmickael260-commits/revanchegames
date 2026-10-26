"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { useSocial } from "./SocialProvider";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { GroupChatDialog } from "./GroupChatDialog";
import { createClient } from "@/lib/supabase/client";
import { listMyGroups, type FriendGroup } from "@/lib/social/groups";

const BADGE_CAP = 99;

/**
 * « Mes groupes » — la liste, dans la page Amis.
 *
 * L'état vit ici plutôt que dans <SocialProvider> : les groupes ne sont
 * consultés que depuis cet écran et depuis le profil, alors que le
 * fournisseur est monté sur **toutes** les pages. Y charger les groupes
 * ferait une requête supplémentaire à chaque visite, y compris en pleine
 * partie, pour une donnée qu'on ne regarde pas.
 *
 * Deux abonnements temps réel suffisent à garder la liste juste : les
 * messages (pour les non-lus et l'aperçu) et les appartenances (pour être
 * ajouté ou retiré d'un groupe). Les deux tables sont limitées par RLS, donc
 * on ne reçoit d'événement que pour ses propres groupes.
 */
export function GroupsSection() {
  const { me, presence } = useSocial();
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  /** Applique un résultat de chargement. Ne fait que poser l'état. */
  const apply = useCallback((result: Awaited<ReturnType<typeof listMyGroups>>) => {
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setGroups(result.data);
    setError("");
    setLoading(false);
  }, []);

  /** Rechargement déclenché par une action ou un événement temps réel. */
  const load = useCallback(async () => {
    apply(await listMyGroups());
  }, [apply]);

  // Chargement initial. Le `setState` vit après l'`await`, dans la fonction
  // asynchrone — pas dans le corps de l'effet, ce qui provoquerait un rendu
  // en cascade — et `cancelled` évite d'écrire dans un composant démonté.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const result = await listMyGroups();
      if (!cancelled) apply(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [me, apply]);

  useEffect(() => {
    if (!me) return;
    const supabase = createClient();
    const channel = supabase
      .channel("rg-groups")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_group_messages" },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_group_members" },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, load]);

  if (!me) return null;

  const openGroup = groups.find((group) => group.id === openGroupId) ?? null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
          Mes groupes ({groups.length})
        </h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-3 py-1.5 font-display text-xs font-semibold text-void"
        >
          <Plus className="h-3.5 w-3.5" />
          Créer un groupe
        </button>
      </div>

      {error && <p className="font-body text-xs text-violet-soft">{error}</p>}

      {loading ? (
        <div className="h-16 animate-pulse rounded-xl border border-border-soft bg-surface" />
      ) : groups.length === 0 ? (
        <p className="rounded-xl border border-border-soft bg-surface px-4 py-3.5 font-body text-sm text-text-faint">
          Aucun groupe pour l&apos;instant. Crée-en un pour discuter à plusieurs et inviter tout
          le monde à jouer en une fois.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => {
            // Membres en ligne, soi-même exclu — on sait déjà qu'on est là.
            const online = group.memberIds.filter(
              (id) => id !== me.id && (presence.get(id)?.status ?? "offline") !== "offline",
            ).length;

            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => setOpenGroupId(group.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-left transition-colors hover:border-border"
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised">
                    <Users className="h-4 w-4 text-cyan" />
                    {group.unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-cyan to-violet px-1 py-0.5 font-display text-[10px] font-bold leading-none text-void">
                        {group.unreadCount > BADGE_CAP ? `${BADGE_CAP}+` : group.unreadCount}
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-semibold text-text">
                      {group.name}
                    </span>
                    <span className="block truncate font-body text-[11px] text-text-faint">
                      {group.lastMessagePreview
                        ? group.lastMessagePreview
                        : `${group.memberCount} membre${group.memberCount > 1 ? "s" : ""}`}
                    </span>
                  </span>

                  <span className="shrink-0 text-right font-body text-[11px] text-text-faint">
                    {group.memberCount} membre{group.memberCount > 1 ? "s" : ""}
                    {online > 0 && (
                      <span className="block text-cyan">{online} en ligne</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <CreateGroupDialog
          onClose={() => setCreating(false)}
          onCreated={async (groupId) => {
            setCreating(false);
            await load();
            setOpenGroupId(groupId);
          }}
        />
      )}

      {openGroup && (
        <GroupChatDialog
          group={openGroup}
          onClose={() => {
            setOpenGroupId(null);
            void load();
          }}
          onChanged={load}
        />
      )}
    </section>
  );
}
