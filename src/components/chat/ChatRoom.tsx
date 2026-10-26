"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";

const MAX_LENGTH = 500;

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
};

type IncomingRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatRoom({
  initialMessages,
  me,
}: {
  initialMessages: ChatMessage[];
  me: { id: string; username: string; avatarUrl: string | null } | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  // Avoids a profile lookup per incoming row for senders we've already seen,
  // including ourselves and anyone whose message is already in initialMessages.
  const profileCache = useRef(
    new Map(initialMessages.map((m) => [m.userId, { username: m.username, avatarUrl: m.avatarUrl }])),
  );
  if (me) profileCache.current.set(me.id, { username: me.username, avatarUrl: me.avatarUrl });
  // Tracked outside React state so the realtime handler can skip messages
  // already shown (e.g. its own optimistic send) without waiting on a render.
  const seenIds = useRef(new Set(initialMessages.map((m) => m.id)));

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const row = payload.new as IncomingRow;
          if (seenIds.current.has(row.id)) return; // already shown (optimistic send)
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

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                body: row.body,
                createdAt: row.created_at,
                userId: row.user_id,
                username: profile!.username,
                avatarUrl: profile!.avatarUrl,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!me) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_LENGTH) {
      setError(`Les messages sont limités à ${MAX_LENGTH} caractères.`);
      return;
    }

    setError("");
    setSending(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("chat_messages")
      .insert({ user_id: me.id, body: trimmed })
      .select("id, created_at")
      .single();
    setSending(false);

    if (insertError || !data) {
      setError("Message non envoyé — réessaie.");
      return;
    }

    seenIds.current.add(data.id);
    setDraft("");
    setMessages((prev) =>
      prev.some((m) => m.id === data.id)
        ? prev
        : [...prev, { id: data.id, body: trimmed, createdAt: data.created_at, userId: me.id, username: me.username, avatarUrl: me.avatarUrl }],
    );
  }

  return (
    <div className="flex h-[65vh] flex-col rounded-2xl border border-border-soft bg-surface">
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center font-body text-sm text-text-faint">
            Aucun message pour l&apos;instant — sois le premier à dire bonjour !
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => {
              const own = me?.id === message.userId;
              return (
                <div key={message.id} className={`flex items-start gap-2.5 ${own ? "flex-row-reverse text-right" : ""}`}>
                  <Avatar username={message.username} avatarUrl={message.avatarUrl} size="sm" />
                  <div className={`flex min-w-0 max-w-[75%] flex-col gap-0.5 ${own ? "items-end" : "items-start"}`}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-xs font-semibold text-text-dim">{message.username}</span>
                      <span className="font-body text-[0.7rem] text-text-faint">{formatTime(message.createdAt)}</span>
                    </div>
                    <p
                      className={`break-words rounded-xl px-3 py-1.5 font-body text-sm text-text ${
                        own ? "bg-gradient-to-r from-cyan/20 to-violet/20" : "bg-surface-raised"
                      }`}
                    >
                      {message.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {me ? (
        <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border-soft p-3">
          <div className="flex-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_LENGTH}
              placeholder="Écris un message…"
              aria-label="Votre message"
              className="w-full rounded-lg border border-border-soft bg-void px-3.5 py-2.5 font-body text-sm text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20"
            />
            {error && <p className="mt-1.5 font-body text-xs text-violet-soft">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Envoyer"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-cyan to-violet text-void disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      ) : null}
    </div>
  );
}
