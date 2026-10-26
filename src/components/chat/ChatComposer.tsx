"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { CHAT_MAX_LENGTH, type ChatIdentity } from "@/lib/chat-shared";

/**
 * La zone de saisie, partagée par le salon /chat et le chat flottant.
 * Non connecté : propose de se connecter, et n'offre aucun champ — l'insertion
 * serait de toute façon refusée par RLS côté Supabase.
 */
export function ChatComposer({
  me,
  sending,
  error,
  onSend,
  compact = false,
}: {
  me: ChatIdentity | null;
  sending: boolean;
  error: string;
  onSend: (body: string) => Promise<boolean>;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = await onSend(draft);
    if (ok) setDraft("");
  }

  if (!me) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-soft p-3">
        <p className="font-body text-xs text-text-faint">
          Connecte-toi pour participer à la discussion.
        </p>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/sign-in"
            className="rounded-lg border border-border-soft px-3 py-1.5 font-display text-xs font-semibold text-text-dim"
          >
            Se connecter
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-gradient-to-r from-cyan to-violet px-3 py-1.5 font-display text-xs font-semibold text-void"
          >
            Créer un compte
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex shrink-0 items-end gap-2 border-t border-border-soft ${
        compact ? "p-2" : "p-2.5 sm:p-3"
      }`}
    >
      <div className="min-w-0 flex-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Écris un message…"
          aria-label="Votre message"
          // text-base (16 px) sur petit écran, pour que le focus ne déclenche
          // pas le zoom automatique d'iOS Safari (tout ce qui est sous 16 px).
          className="w-full rounded-lg border border-border-soft bg-void px-3.5 py-2.5 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20 sm:text-sm"
        />
        {error && <p className="mt-1.5 font-body text-xs text-violet-soft">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={sending || !draft.trim()}
        aria-label="Envoyer"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-cyan to-violet text-void disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}
