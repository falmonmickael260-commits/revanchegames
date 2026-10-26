"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import { sendDirectMessage, markDirectMessagesRead, type DirectMessageRow } from "./social/api";
import type { ChatMessage, ChatIdentity } from "./chat-shared";

const HISTORY_LIMIT = 100;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Une conversation privée avec un ami précis.
 *
 * Réutilise volontairement la forme `ChatMessage` du salon général : l'avatar,
 * la bulle, le collage en bas et le bouton « nouveaux messages » sont
 * exactement les mêmes besoins d'affichage, donc <ChatMessageList /> et
 * <ChatComposer /> s'appliquent sans modification — seule la source des
 * messages change.
 *
 * `from`/`to` ne sont pas de simples labels : un message privé n'a pas de
 * jointure `profiles` à charger côté serveur, donc le nom et l'avatar de
 * l'autre joueur viennent directement du `FriendEntry` déjà en mémoire
 * (passé en paramètre), jamais d'une seconde requête.
 */
export function useDirectMessages({
  me,
  other,
  enabled = true,
}: {
  me: ChatIdentity | null;
  other: { id: string; username: string; avatarUrl: string | null } | null;
  enabled?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const seenIds = useRef<Set<string>>(new Set());

  const toChatMessage = useCallback(
    (row: DirectMessageRow): ChatMessage => {
      const isMine = row.from_user_id === me?.id;
      return {
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        userId: row.from_user_id,
        username: isMine ? (me?.username ?? "Toi") : (other?.username ?? "Joueur"),
        avatarUrl: isMine ? (me?.avatarUrl ?? null) : (other?.avatarUrl ?? null),
      };
    },
    [me, other],
  );

  const ingest = useCallback((row: DirectMessageRow) => {
    if (seenIds.current.has(row.id)) return;
    seenIds.current.add(row.id);
    setMessages((previous) => [...previous, toChatMessage(row)]);
  }, [toChatMessage]);

  // Historique, propre à cette paire de joueurs.
  useEffect(() => {
    if (!enabled || !me || !other) return;
    let cancelled = false;
    seenIds.current = new Set();
    setLoading(true);

    (async () => {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("direct_messages")
        .select("id, from_user_id, to_user_id, body, created_at")
        .eq("pair_key", pairKey(me.id, other.id))
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);

      if (cancelled) return;
      if (loadError) {
        setError("Conversation indisponible — vérifie ta connexion.");
        setLoading(false);
        return;
      }

      const rows = (data ?? []).slice().reverse() as DirectMessageRow[];
      rows.forEach((row) => seenIds.current.add(row.id));
      setMessages(rows.map(toChatMessage));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, me, other, toChatMessage]);

  // Temps réel, filtré côté serveur sur `pair_key` : seule cette conversation
  // précise arrive sur ce canal, pas celles des autres amis.
  useEffect(() => {
    if (!enabled || !me || !other) return;
    const supabase = createClient();
    const key = pairKey(me.id, other.id);
    const channel = supabase
      .channel(`rg-dm-${key}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `pair_key=eq.${key}` },
        (payload) => ingest(payload.new as DirectMessageRow),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, me, other, ingest]);

  const send = useCallback(
    async (body: string): Promise<boolean> => {
      if (!other) return false;
      const trimmed = body.trim();
      if (!trimmed) return false;

      setError("");
      setSending(true);
      const result = await sendDirectMessage(other.id, trimmed);
      setSending(false);

      if (!result.ok) {
        setError(result.error);
        return false;
      }
      ingest(result.data);
      return true;
    },
    [other, ingest],
  );

  const markRead = useCallback(async () => {
    if (!other) return;
    await markDirectMessagesRead(other.id);
  }, [other]);

  return { messages, loading, sending, error, send, markRead };
}
