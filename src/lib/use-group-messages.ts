"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import { markGroupRead, sendGroupMessage, type GroupMessage } from "./social/groups";

const HISTORY_LIMIT = 100;

type Row = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type Profile = { username: string; avatar_url: string | null };

/**
 * La conversation d'un groupe : historique, temps réel, envoi.
 *
 * Même forme que `use-direct-messages` — un historique chargé une fois, puis
 * un abonnement Realtime filtré sur ce groupe. Le filtre `group_id=eq.…`
 * compte : sans lui, chaque client recevrait les insertions de tous les
 * groupes et les écarterait côté navigateur, ce qui ferait transiter des
 * messages qu'il n'a pas à voir.
 *
 * Les permissions ne sont pas réimplémentées ici : lire passe par RLS
 * (`am_i_group_member`), écrire par `send_group_message`, qui revérifie
 * l'appartenance.
 */
export function useGroupMessages({
  groupId,
  enabled = true,
}: {
  groupId: string | null;
  enabled?: boolean;
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const seenIds = useRef<Set<string>>(new Set());
  // Évite une requête de profil par message pour un expéditeur déjà vu.
  const profiles = useRef<Map<string, Profile>>(new Map());

  const decorate = useCallback(async (row: Row): Promise<GroupMessage> => {
    let profile = profiles.current.get(row.user_id);
    if (!profile) {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", row.user_id)
        .single();
      profile = { username: data?.username ?? "Joueur", avatar_url: data?.avatar_url ?? null };
      profiles.current.set(row.user_id, profile);
    }
    return {
      id: row.id,
      groupId: row.group_id,
      userId: row.user_id,
      body: row.body,
      createdAt: row.created_at,
      username: profile.username,
      avatarUrl: profile.avatar_url,
    };
  }, []);

  const ingest = useCallback((message: GroupMessage) => {
    setMessages((previous) =>
      previous.some((m) => m.id === message.id) ? previous : [...previous, message],
    );
  }, []);

  // Historique.
  useEffect(() => {
    if (!enabled || !groupId) return;
    let cancelled = false;
    seenIds.current = new Set();

    (async () => {
      // Posé dans la fonction asynchrone, pas dans le corps de l'effet :
      // un setState synchrone dans un effet déclenche un rendu en cascade.
      setLoading(true);
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("friend_group_messages")
        .select("id, group_id, user_id, body, created_at, profiles!friend_group_messages_user_id_fkey(username, avatar_url)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);

      if (cancelled) return;
      if (loadError) {
        setError("Conversation indisponible — vérifie ta connexion.");
        setLoading(false);
        return;
      }

      type JoinedRow = Row & { profiles: Profile | null };
      const rows = ((data ?? []) as unknown as JoinedRow[]).slice().reverse();

      const decorated = rows.map((row) => {
        if (row.profiles) profiles.current.set(row.user_id, row.profiles);
        seenIds.current.add(row.id);
        return {
          id: row.id,
          groupId: row.group_id,
          userId: row.user_id,
          body: row.body,
          createdAt: row.created_at,
          username: row.profiles?.username ?? "Joueur",
          avatarUrl: row.profiles?.avatar_url ?? null,
        };
      });

      setMessages(decorated);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, groupId]);

  // Temps réel, limité à ce groupe.
  useEffect(() => {
    if (!enabled || !groupId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`rg-group-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friend_group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const row = payload.new as Row;
          if (seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          ingest(await decorate(row));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, groupId, decorate, ingest]);

  const send = useCallback(
    async (body: string): Promise<boolean> => {
      if (!groupId) return false;
      const trimmed = body.trim();
      if (!trimmed) return false;

      setError("");
      setSending(true);
      const result = await sendGroupMessage(groupId, trimmed);
      setSending(false);

      if (!result.ok) {
        setError(result.error);
        return false;
      }

      seenIds.current.add(result.data.id);
      ingest(await decorate(result.data as Row));
      return true;
    },
    [groupId, ingest, decorate],
  );

  const markRead = useCallback(async () => {
    if (!groupId) return;
    await markGroupRead(groupId);
  }, [groupId]);

  return { messages, loading, sending, error, send, markRead };
}
