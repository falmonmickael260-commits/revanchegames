"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Crown, Headphones, Mic, MicOff, UserPlus, Users } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { requestPushDelivery } from "@/lib/push-client";
import { useVoice } from "./VoiceProvider";
import { VOICE_CAPACITY, type VoiceRoom } from "@/lib/voice-shared";

export function VoiceRooms() {
  const { me, ready, friends } = useSocial();
  const voice = useVoice();
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showInvites, setShowInvites] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/voice", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chargement impossible.");
      if (signal?.aborted) return;
      setRooms(data.rooms); setError("");
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Chargement impossible.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!me) return;
    const controller = new AbortController();
    const initial = setTimeout(() => void refresh(controller.signal), 0);
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(controller.signal); }, 5000);
    return () => { controller.abort(); clearTimeout(initial); clearInterval(timer); };
  }, [me, refresh, voice.current?.id]);

  const invite = async (friendId: string) => {
    if (!voice.current || inviting) return;
    setInviting(friendId); setInviteError("");
    try {
      const response = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", roomId: voice.current.id, friendId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Invitation impossible.");
      const key = `${voice.current.id}:${voice.current.instanceId}:${friendId}`;
      setSent(previous => new Set([...previous, key]));
      void requestPushDelivery({ type: "direct_message", messageId: data.messageId });
    } catch (cause) { setInviteError(cause instanceof Error ? cause.message : "Invitation impossible."); }
    finally { setInviting(null); }
  };

  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-soft bg-surface-raised px-4 py-2 text-sm disabled:opacity-40";
  const canInvite = voice.current?.visibility === "public" || voice.current?.hostId === me?.id;
  return <div className="mx-auto max-w-5xl px-4 py-6 pb-52 sm:px-6 lg:px-8">
    <PageHeader eyebrow="Communauté" title="Salons vocaux" subtitle="Un salon, des voix, un chat : retrouve tes amis ou fais de nouvelles rencontres." />
    {!ready ? <p className="mt-6" role="status">Chargement…</p> : !me ? <p className="mt-6">Connecte-toi pour créer ou rejoindre une salle. <Link href="/sign-in?next=/voice" className="text-cyan">Se connecter</Link></p> : <>
      {(error || voice.error) && <p role="alert" className="mt-4 rounded-xl border border-rose-400/40 p-3 text-sm text-rose-300">{voice.error || error}</p>}
      {voice.current ? <section aria-label="Ta salle vocale" className="mt-6 overflow-hidden rounded-3xl border border-cyan/30 bg-surface shadow-xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft bg-gradient-to-r from-violet/20 to-cyan/10 p-5">
          <div><h2 className="font-display text-xl font-semibold">{voice.current.title}</h2>
            <p className="mt-2 flex items-center gap-2 text-xs text-text-dim"><Users className="h-4 w-4" />{voice.members.length}/{VOICE_CAPACITY} · {voice.current.visibility === "public" ? "Salle publique" : "Amis uniquement"}</p>
          </div>
          {canInvite && <button type="button" className={button} onClick={() => setShowInvites(value => !value)} aria-expanded={showInvites}><UserPlus className="h-4 w-4" />Inviter des amis</button>}
        </header>
        <div className="px-3 py-7 sm:px-8">
          <ul className="mx-auto grid max-w-xl grid-cols-4 gap-x-2 gap-y-6 sm:gap-x-6" aria-label="Participants">
            {Array.from({ length: VOICE_CAPACITY }, (_, index) => {
              const member = voice.members[index];
              return <li key={member?.id || `seat-${index}`} className="flex min-w-0 flex-col items-center gap-2 text-center">
                {member ? <>
                  <div className={`relative rounded-full transition-shadow ${member.speaking ? "ring-4 ring-cyan/70 shadow-[0_0_24px_var(--rg-cyan)]" : "ring-2 ring-border-soft"}`}>
                    <Avatar username={member.name} avatarUrl={member.avatarUrl} />
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-border-soft bg-abyss p-1.5">{member.muted ? <MicOff aria-label="Micro coupé" className="h-3 w-3 text-text-faint" /> : <Mic aria-label="Micro actif" className="h-3 w-3 text-cyan" />}</span>
                    {member.id === voice.current?.hostId && <Crown aria-label="Hôte" className="absolute -right-1 -top-3 h-5 w-5 fill-amber-300 text-amber-300" />}
                  </div>
                  <span className="w-full truncate text-xs font-semibold" title={member.name}>{member.name}</span>
                  <span className={`text-[10px] ${member.speaking ? "text-cyan" : "text-text-faint"}`}>{member.id === voice.current?.hostId ? "Hôte · " : ""}{member.muted ? "Micro coupé" : member.speaking ? "Parle" : "Micro actif"}</span>
                </> : <>
                  <button type="button" disabled={!canInvite} onClick={() => setShowInvites(true)} aria-label="Inviter à une place libre" className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border-soft bg-abyss/50 text-text-faint disabled:cursor-default"><UserPlus className="h-6 w-6" /></button>
                  <span className="text-[10px] text-text-faint">Place libre</span>
                </>}
              </li>;
            })}
          </ul>
        </div>
        <div className="flex flex-wrap justify-center gap-2 border-t border-border-soft px-3 py-4">
          <button type="button" className={button + (voice.muted ? "" : " border-cyan/50 text-cyan")} onClick={() => void voice.toggleMic()}>{voice.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{voice.muted ? "Activer le micro" : "Couper le micro"}</button>
          {voice.needsAudio && <button type="button" className={button} onClick={() => void voice.enableAudio()}>Activer le son</button>}
          <button type="button" className={button + " text-rose-300"} onClick={voice.leave}>Quitter la salle</button>
        </div>
        {showInvites && canInvite && <section aria-label="Inviter des amis au vocal" className="border-t border-border-soft p-4">
          <h3 className="mb-3 font-semibold">Inviter des amis</h3>
          {inviteError && <p role="alert" className="mb-3 text-sm text-rose-300">{inviteError}</p>}
          {!friends.length && <p className="text-sm text-text-dim">Ajoute des amis depuis l’onglet Amis pour les inviter.</p>}
          <ul className="max-h-64 space-y-2 overflow-y-auto">{friends.map(friend => {
            const done = sent.has(`${voice.current?.id}:${voice.current?.instanceId}:${friend.id}`);
            return <li key={friend.id} className="flex items-center gap-3 rounded-xl bg-abyss/60 p-2">
              <Avatar username={friend.username} avatarUrl={friend.avatarUrl} size="sm" /><span className="min-w-0 flex-1 truncate text-sm">{friend.username}</span>
              <button type="button" className={button} disabled={Boolean(inviting) || done || voice.members.length >= VOICE_CAPACITY} onClick={() => void invite(friend.id)} aria-label={`Inviter ${friend.username} au vocal`}>{done ? "Envoyée" : inviting === friend.id ? "Envoi…" : "Inviter"}</button>
            </li>;
          })}</ul>
        </section>}
        <section aria-label="Chat de la salle" className="flex h-[420px] min-h-0 flex-col border-t border-border-soft bg-abyss/40">
          <header className="border-b border-border-soft px-4 py-3"><h3 className="text-sm font-semibold">Chat de la salle</h3><p className="mt-1 text-xs text-text-faint">Chat éphémère · uniquement pour les participants de cette salle.</p></header>
          <ChatMessageList messages={voice.messages} me={me} loading={false} />
          <ChatComposer me={me} sending={voice.sending} error={voice.chatError} onSend={voice.sendMessage} />
        </section>
      </section> : <form className="mt-6 space-y-4 rounded-2xl border border-border-soft bg-surface p-5" onSubmit={event => { event.preventDefault(); void voice.join("create", title, visibility); }}>
        <div className="flex items-center gap-3"><Headphones className="h-6 w-6 text-cyan" /><h2 className="font-semibold">Créer ta salle éphémère</h2></div>
        <label className="block text-sm">Nom de la salle<input required maxLength={60} value={title} onChange={event => setTitle(event.target.value)} placeholder="Le salon des amis" className="mt-2 block min-h-11 w-full rounded-xl border border-border-soft bg-abyss px-3 text-base" /></label>
        <label className="block text-sm">Qui peut rejoindre ?<select value={visibility} onChange={event => setVisibility(event.target.value as "public" | "friends")} className="mt-2 block min-h-11 w-full rounded-xl border border-border-soft bg-abyss px-3 text-base"><option value="public">Tous les membres · Salle publique</option><option value="friends">Mes amis uniquement</option></select></label>
        <p className="text-xs text-text-faint">Tu deviens hôte. Jusqu’à {VOICE_CAPACITY} personnes, micro coupé à l’entrée. La salle disparaît après une minute vide.</p>
        <button className={button + " w-full text-cyan sm:w-auto"} disabled={voice.busy || Boolean(error) || !title.trim()}>{voice.busy ? "Connexion…" : "Créer une salle éphémère"}</button>
      </form>}
      <h2 className="mt-8 text-lg font-semibold">Salles à rejoindre</h2>
      <p className="mt-1 text-sm text-text-dim">Découvre les salles publiques et les salles de tes amis.</p>
      {loading ? <p className="mt-4" role="status">Chargement des salles…</p> : rooms.length === 0 && !error ? <p className="mt-4 text-text-dim">Aucune salle ouverte. Crée la première !</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{rooms.map(room => <section key={room.id} className="rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex items-center gap-3"><Avatar username={room.hostName} avatarUrl={room.hostAvatar} /><div className="min-w-0"><h3 className="truncate font-semibold">{room.title}</h3><p className="mt-1 text-xs text-text-dim">{room.hostName} · Hôte</p></div></div>
        <p className="my-3 text-xs text-text-dim">{room.visibility === "public" ? "Publique" : "Amis uniquement"} · {room.count}/{VOICE_CAPACITY} personnes</p>
        <button type="button" className={button + " w-full"} disabled={voice.busy || Boolean(voice.current) || room.count >= VOICE_CAPACITY} onClick={() => void voice.join("join", room.id)}>{room.count >= VOICE_CAPACITY ? "Salle complète" : "Rejoindre le vocal"}</button>
      </section>)}</div>
      <Link href="/friends" className="mt-6 inline-block min-h-11 text-cyan">Retrouver mes amis</Link>
    </>}
  </div>;
}
