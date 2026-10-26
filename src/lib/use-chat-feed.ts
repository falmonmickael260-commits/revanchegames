"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import {
  CHAT_HISTORY_LIMIT,
  CHAT_MAX_LENGTH,
  rowsToMessages,
  type ChatHistoryRow,
  type ChatIdentity,
  type ChatMessage,
} from "./chat-shared";

// Re-exportes pour que les composants clients n'aient qu'un import a faire.
export {
  CHAT_MAX_LENGTH,
  CHAT_HISTORY_LIMIT,
  rowsToMessages,
  formatChatTime,
} from "./chat-shared";
export type { ChatMessage, ChatIdentity, ChatHistoryRow } from "./chat-shared";

type IncomingRow = { id: string; body: string; created_at: string; user_id: string };

/**
 * Le moteur du chat général : historique, temps réel, envoi.
 *
 * Extrait de <ChatRoom /> pour que le salon de la page /chat et le chat
 * flottant affiché pendant une partie partagent exactement le même code —
 * mêmes messages, même déduplication, mêmes règles d'envoi — au lieu de deux
 * implémentations à garder synchronisées.
 *
 * Les permissions ne sont pas réimplémentées ici : la table `chat_messages`
 * est protégée par RLS côté Supabase (lecture pour tous, insertion seulement
 * de ses propres messages, cf. migration 20261025000000_platform_core.sql).
 * Un joueur non connecté n'a donc aucun moyen d'écrire, même en appelant
 * `send` directement.
 *
 * @param seed      Historique déjà rendu côté serveur, s'il y en a. Fourni :
 *                  aucune requête de chargement n'est faite. Absent : le hook
 *                  charge l'historique lui-même.
 * @param me        Le joueur connecté, ou null (lecture seule).
 * @param channelKey Nom du canal Realtime. Deux instances simultanées doivent
 *                  utiliser des noms distincts pour ne pas se marcher dessus.
 */
export function useChatFeed({
  seed,
  me,
  channelKey,
  enabled = true,
}: {
  seed?: ChatMessage[];
  me: ChatIdentity | null;
  channelKey: string;
  enabled?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(seed ?? []);
  const [loading, setLoading] = useState(!seed);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Hors état React : le gestionnaire temps réel doit pouvoir écarter un
  // message déjà affiché (son propre envoi optimiste) sans attendre un rendu.
  const seenIds = useRef<Set<string>>(new Set(seed?.map((m) => m.id)));
  // Évite une requête de profil par message entrant pour un expéditeur déjà vu.
  const profileCache = useRef<Map<string, { username: string; avatarUrl: string | null }>>(
    new Map(seed?.map((m) => [m.userId, { username: m.username, avatarUrl: m.avatarUrl }])),
  );

  // Les refs sont renseignées ici et non pendant le rendu : y toucher pendant
  // le rendu est ce que signalait `react-hooks/refs`, et c'est un vrai piège
  // (un rendu abandonné par React laisserait la ref salie).
  useEffect(() => {
    if (!me) return;
    profileCache.current.set(me.id, { username: me.username, avatarUrl: me.avatarUrl });
  }, [me]);

  const ingest = useCallback((message: ChatMessage) => {
    setMessages((previous) =>
      previous.some((m) => m.id === message.id) ? previous : [...previous, message],
    );
  }, []);

  // Chargement de l'historique quand il n'a pas été rendu côté serveur.
  useEffect(() => {
    if (!enabled || seed) return;
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("chat_messages")
        .select("id, body, created_at, user_id, profiles(username, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(CHAT_HISTORY_LIMIT);

      if (cancelled) return;

      if (loadError) {
        setError("Chat indisponible — vérifie ta connexion.");
        setLoading(false);
        return;
      }

      const loaded = rowsToMessages(data as unknown as ChatHistoryRow[]);
      loaded.forEach((m) => {
        seenIds.current.add(m.id);
        profileCache.current.set(m.userId, { username: m.username, avatarUrl: m.avatarUrl });
      });
      setMessages((previous) => {
        // Un message arrivé en direct pendant le chargement est conservé.
        const known = new Set(loaded.map((m) => m.id));
        return [...loaded, ...previous.filter((m) => !known.has(m.id))];
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, seed]);

  // Abonnement temps réel.
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel(channelKey)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const row = payload.new as IncomingRow;
          if (seenIds.current.has(row.id)) return; // déjà affiché
          seenIds.current.add(row.id);

          let profile = profileCache.current.get(row.user_id);
          if (!profile) {
            const { data } = await supabase
              .from("profiles")
              .select("username, avatar_url")
              .eq("id", row.user_id)
              .single();
            profile = { username: data?.username ?? "Joueur", avatarUrl: data?.avatar_url ?? null };
            profileCache.current.set(row.user_id, profile);
          }

          ingest({
            id: row.id,
            body: row.body,
            createdAt: row.created_at,
            userId: row.user_id,
            username: profile.username,
            avatarUrl: profile.avatarUrl,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, channelKey, ingest]);

  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      if (!me) return false;
      const body = raw.trim();
      if (!body) return false;
      if (body.length > CHAT_MAX_LENGTH) {
        setError(`Les messages sont limités à ${CHAT_MAX_LENGTH} caractères.`);
        return false;
      }

      setError("");
      setSending(true);
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("chat_messages")
        .insert({ user_id: me.id, body })
        .select("id, created_at")
        .single();
      setSending(false);

      if (insertError || !data) {
        setError("Message non envoyé — réessaie.");
        return false;
      }

      seenIds.current.add(data.id);
      ingest({
        id: data.id,
        body,
        createdAt: data.created_at,
        userId: me.id,
        username: me.username,
        avatarUrl: me.avatarUrl,
      });
      return true;
    },
    [me, ingest],
  );

  return { messages, loading, sending, error, setError, send };
}

/**
 * Le joueur connecté, tel que le chat en a besoin (pseudo + avatar).
 *
 * La page /chat obtient la même chose côté serveur ; le chat flottant est
 * monté dans la coquille, qui n'a pas accès à la session côté serveur, et doit
 * donc la lire côté navigateur. Les deux visent la même table `profiles`.
 */
export function useChatIdentity(): { me: ChatIdentity | null; ready: boolean } {
  const [me, setMe] = useState<ChatIdentity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load(userId: string | null) {
      if (!userId) {
        if (!cancelled) {
          setMe(null);
          setReady(true);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", userId)
        .single();
      if (cancelled) return;
      setMe({
        id: userId,
        username: data?.username ?? "Joueur",
        avatarUrl: data?.avatar_url ?? null,
      });
      setReady(true);
    }

    supabase.auth.getUser().then(({ data }) => load(data.user?.id ?? null));

    // Connexion ou déconnexion dans un autre onglet pendant la partie.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { me, ready };
}
