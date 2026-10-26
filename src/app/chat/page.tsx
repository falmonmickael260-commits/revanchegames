import { Suspense } from "react";
import { connection } from "next/server";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChatRoom, type ChatMessage } from "@/components/chat/ChatRoom";
import { createClient } from "@/lib/supabase/server";

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatContent />
    </Suspense>
  );
}

function ChatSkeleton() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader eyebrow="Communauté" title="Chat général" />
      <div className="min-h-0 flex-1 animate-pulse rounded-2xl border border-border-soft bg-surface" />
    </div>
  );
}

// The session and the initial message history are both only known at request
// time — see docs/PLATFORM.md / Next.js 16 Cache Components.
async function ChatContent() {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const { data: rows } = await supabase
    .from("chat_messages")
    .select("id, body, created_at, user_id, profiles(username, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(50);

  const initialMessages: ChatMessage[] = ((rows as unknown as RawMessageRow[]) ?? [])
    .map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      userId: row.user_id,
      username: row.profiles?.username ?? "Joueur",
      avatarUrl: row.profiles?.avatar_url ?? null,
    }))
    .reverse();

  let me: { id: string; username: string; avatarUrl: string | null } | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();
    me = { id: user.id, username: profile?.username ?? "Joueur", avatarUrl: profile?.avatar_url ?? null };
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="shrink-0">
        <PageHeader
          eyebrow="Communauté"
          title="Chat général"
          subtitle="Un seul salon pour tout le monde, tous jeux confondus."
        />
      </div>
      <ChatRoom initialMessages={initialMessages} me={me} />
      <p className="hidden shrink-0 items-center gap-1.5 font-body text-xs text-text-faint sm:flex">
        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
        Les 50 derniers messages, visibles par tous — pense à rester sympa.
      </p>
    </div>
  );
}

type RawMessageRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; avatar_url: string | null } | null;
};
