"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";
import { createClient } from "@/lib/supabase/client";
import { VoiceInvitation } from "./VoiceInvitation";
import { useVoice } from "./VoiceProvider";

type Invite = { id: string; body: string; voice_room_id: string; voice_expires_at: string };
export function VoiceInviteToast() {
  const { me } = useSocial();
  return me ? <Inbox key={me.id} userId={me.id} /> : null;
}
function Inbox({ userId }: { userId: string }) {
  const [invitations, setInvitations] = useState<Invite[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { current } = useVoice();
  useEffect(() => {
    let stopped = false;
    const db = createClient();
    const load = async () => {
      const { data } = await db.from("direct_messages").select("id,body,voice_room_id,voice_expires_at")
        .eq("to_user_id", userId).not("voice_room_id", "is", null).is("read_at", null)
        .gt("voice_expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(10);
      if (!stopped) setInvitations((data ?? []) as Invite[]);
    };
    const channel = db.channel(`rg-voice-invites-${userId}`).on("postgres_changes", {
      event: "*", schema: "public", table: "direct_messages", filter: `to_user_id=eq.${userId}`,
    }, () => void load()).subscribe(status => { if (status === "SUBSCRIBED") void load(); });
    const first = setTimeout(() => void load(), 0), timer = setInterval(() => void load(), 15000);
    return () => { stopped = true; clearTimeout(first); clearInterval(timer); void db.removeChannel(channel); };
  }, [userId]);
  const invitation = invitations.find(i => !hidden.has(i.id) && i.voice_room_id !== current?.id);
  if (!invitation) return null;
  const dismiss = () => setHidden(previous => new Set([...previous, invitation.id]));
  return <aside aria-label="Invitation au salon vocal" className="fixed right-3 top-20 z-[80] w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-cyan/40 bg-abyss p-4 shadow-xl">
    <div className="flex items-start gap-2"><p className="flex-1 text-sm">{invitation.body}</p>
      <button type="button" aria-label="Masquer l’invitation vocale" onClick={dismiss} className="p-2"><X className="h-4 w-4" /></button></div>
    <VoiceInvitation id={invitation.id} roomId={invitation.voice_room_id} expiresAt={invitation.voice_expires_at} onJoined={dismiss} />
  </aside>;
}
