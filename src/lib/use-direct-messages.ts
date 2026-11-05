"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import { sendDirectMessage, markDirectMessagesRead, type DirectMessageRow } from "./social/api";
import { requestPushDelivery } from "./push-client";
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
    (row: DirectMessageRow, live = false): ChatMessage => {
      const isMine = row.from_user_id === me?.id;
      return {
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        userId: row.from_user_id,
        username: isMine ? (me?.username ?? "Toi") : (other?.username ?? "Joueur"),
        avatarUrl: isMine ? (me?.avatarUrl ?? null) : (other?.avatarUrl ?? null),
        invitationId: row.invitation_id ?? null,
        voiceInvitation: row.voice_room_id && row.voice_expires_at ? { roomId: row.voice_room_id, expiresAt: row.voice_expires_at } : null,
        giftBatchId: row.gift_batch_id ?? null,
        live,
      };
    },
    [me, other],
  );

  const ingest = useCallback((row: DirectMessageRow) => {
    if (seenIds.current.has(row.id)) return;
    seenIds.current.add(row.id);
    setMessages((previous) => [...previous, toChatMessage(row, true)]);
  }, [toChatMessage]);

  // Historique, propre à cette paire de joueurs.
  useEffect(() => {
    if (!enabled || !me || !other) return;
    let cancelled = false;
    seenIds.current = new Set();

    const load = async (initial = false) => {
      // `setLoading` est posé ici, dans la fonction asynchrone, et non dans
      // le corps de l'effet : un setState synchrone dans un effet provoque
      // un rendu en cascade (react-hooks/set-state-in-effect).
      if (initial) setLoading(true);
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("direct_messages")
        .select("id, from_user_id, to_user_id, body, created_at, invitation_id, voice_room_id, voice_expires_at, gift_batch_id")
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
      const liveIds = new Set(seenIds.current);
      rows.forEach((row) => seenIds.current.add(row.id));
      setMessages(previous => {
        const values = new Map(rows.map(row => [row.id, toChatMessage(row)]));
        for (const message of previous) if (!initial || liveIds.has(message.id)) values.set(message.id, message);
        return [...values.values()].sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(-HISTORY_LIMIT);
      });
      setLoading(false);
    };
    const first = setTimeout(() => void load(true), 0);
    const resume = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);

    return () => {
      cancelled = true; clearTimeout(first);
      document.removeEventListener("visibilitychange", resume); window.removeEventListener("pageshow", resume);
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
      // Fait sonner le téléphone du destinataire. Volontairement sans
      // `await` ni gestion d'erreur : le message est déjà en base et
      // s'affichera de toute façon ; le push n'est qu'un supplément, et la
      // route elle-même ignore les rafales.
      void requestPushDelivery({ type: "direct_message", messageId: result.data.id });
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
