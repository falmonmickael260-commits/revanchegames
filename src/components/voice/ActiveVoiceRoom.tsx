"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LayoutGrid, LogOut, Mic, MicOff, UserPlus, Users, Volume2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useSocial } from "@/components/social/SocialProvider";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { VOICE_CAPACITY, type VoiceRoom } from "@/lib/voice-shared";
import { useVoice } from "./VoiceProvider";
import { VoiceSeats } from "./VoiceSeats";
import { GiftLauncher } from "@/components/gifts/GiftLauncher";
import { GiftMessageAttachment } from "@/components/gifts/GiftMessageAttachment";
import type { ChatMessage } from "@/lib/chat-shared";

function RoomPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId}
    className="m-auto max-w-md overflow-hidden rounded-2xl border border-border-soft bg-surface p-0 text-text shadow-2xl backdrop:bg-void/75 backdrop:backdrop-blur-sm"
    style={{ width: "calc(100vw - 24px)", maxHeight: "calc(100dvh - 24px)" }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    }}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div>
      <header className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-2">
        <h2 id={titleId} className="text-sm font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Fermer le panneau" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-surface-raised"><X className="h-4 w-4" /></button>
      </header>
      <div className="overflow-y-auto overscroll-contain p-3" style={{ maxHeight: "calc(100dvh - 100px)" }}>{children}</div>
    </div>
  </dialog>;
}

export function ActiveVoiceRoom({ rooms, invite, inviting, sent, inviteError }: {
  rooms: VoiceRoom[]; invite: (id: string) => Promise<void>; inviting: string | null; sent: Set<string>; inviteError: string;
}) {
  const { me, friends } = useSocial();
  const voice = useVoice();
  const keyboardInset = useKeyboardInset();
  const [panel, setPanel] = useState<"participants" | "invite" | "rooms" | null>(null);
  const room = voice.current;
  if (!room || !me) return null;
  const canInvite = room.visibility === "public" || room.hostId === me.id;
  const giftMessages: ChatMessage[] = voice.giftEvents.map(gift => ({
    id: `gift:${gift.id}`, body: `${gift.senderName} a offert ${gift.gift.name} à ${gift.recipientName}.`,
    createdAt: gift.createdAt, userId: gift.senderId, username: gift.senderName,
    avatarUrl: null, giftBatchId: gift.id,
  }));
  const roomMessages = [...voice.messages, ...giftMessages].sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-soft bg-surface-raised px-3 text-xs font-semibold disabled:opacity-40";
  const speakers = voice.members.filter(member => member.speaking);
  return <div className="rg-chat-page-stage rg-voice-room-stage p-2 sm:p-4 lg:p-6" style={{ bottom: keyboardInset ? `${keyboardInset}px` : "var(--rg-bottom-nav-h)" }}>
    <section aria-label="Ta salle vocale" className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan/25 bg-surface shadow-xl">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border-soft bg-gradient-to-r from-violet/15 to-cyan/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><h1 className="truncate font-display text-base font-semibold" title={room.title}>{room.title}</h1>
            <p className="rg-voice-room-meta mt-0.5 text-[10px] text-text-faint">{room.visibility === "public" ? "Salle publique" : "Amis uniquement"} · {voice.members.length}/{VOICE_CAPACITY}</p>
          </div>
          <div className="rg-voice-room-secondary flex shrink-0 items-center gap-1">
            <GiftLauncher meId={me.id} recipients={voice.members.filter(member => member.id !== me.id).map(member => ({ id: member.id, name: member.name }))} context="voice" roomId={room.id} />
            <button type="button" onClick={() => setPanel("participants")} className={button + " min-w-11 gap-1 px-2"} aria-label={`Participants · ${voice.members.length}`} title={`Participants · ${voice.members.length}`} aria-haspopup="dialog"><Users className="h-4 w-4 text-cyan" /><span className="hidden sm:inline">Participants · </span>{voice.members.length}</button>
            {canInvite && <button type="button" className={button + " h-11 w-11 shrink-0 px-0 text-cyan"} aria-label="Inviter des amis" title="Inviter des amis" onClick={() => setPanel("invite")} aria-haspopup="dialog"><UserPlus className="h-4 w-4" /></button>}
          </div>
          <button type="button" className={button + " h-11 w-11 shrink-0 px-0"} aria-label="Autres salons" title="Autres salons" onClick={() => setPanel("rooms")}><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="rg-voice-seats shrink-0 border-b border-border-soft bg-gradient-to-b from-violet/5 to-abyss/20 px-3 py-2">
        <VoiceSeats members={voice.members} hostId={room.hostId} compact onMember={() => setPanel("participants")} onInvite={canInvite ? () => setPanel("invite") : undefined} />
      </div>
      {voice.error && <p role="alert" className="shrink-0 px-3 py-1 text-xs text-rose-300">{voice.error}</p>}
      <section aria-label="Chat de la salle" className="flex min-h-0 flex-1 flex-col bg-abyss/40">
        <div className="rg-voice-chat-heading flex min-h-8 shrink-0 items-center justify-between gap-2 px-3 py-1 text-[10px]">
          <h2 className="shrink-0 font-semibold text-text-dim">Chat de la salle</h2>
          <p className="truncate text-text-faint" role="status">{voice.reconnecting ? "Reconnexion…" : speakers.length ? `${speakers.map(member => member.name).join(", ")} parle${speakers.length > 1 ? "nt" : ""}` : "Discussion éphémère"}</p>
        </div>
        <ChatMessageList messages={roomMessages} me={me} loading={false} compact
          renderAttachment={message => message.giftBatchId ? <GiftMessageAttachment id={message.giftBatchId} /> : null} />
        <ChatComposer me={me} sending={voice.sending} error={voice.chatError} onSend={voice.sendMessage} compact />
      </section>
      <footer className="flex shrink-0 items-center gap-2 border-t border-border-soft p-2">
        <button type="button" className={button + " flex-1" + (voice.muted ? "" : " border-cyan/50 text-cyan")} onClick={() => void voice.toggleMic()} aria-label={voice.muted ? "Activer le micro" : "Couper le micro"}>{voice.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{voice.muted ? "Micro coupé" : "Micro actif"}</button>
        {voice.needsAudio && <button type="button" className={button + " w-11 px-0 text-cyan"} onClick={() => void voice.enableAudio()} aria-label="Activer le son"><Volume2 className="h-4 w-4" /></button>}
        <button type="button" className={button + " text-rose-300"} onClick={voice.leave} aria-label="Quitter la salle"><LogOut className="h-4 w-4" />Quitter</button>
      </footer>
    </section>
    {panel && <RoomPanel key={panel} title={panel === "participants" ? `Participants · ${voice.members.length}/${VOICE_CAPACITY}` : panel === "invite" ? "Inviter des amis" : "Autres salons"} onClose={() => setPanel(null)}>
      {panel === "participants" && <VoiceSeats members={voice.members} hostId={room.hostId} onInvite={canInvite ? () => setPanel("invite") : undefined} />}
      {panel === "invite" && <>
        {inviteError && <p role="alert" className="mb-3 text-xs text-rose-300">{inviteError}</p>}
        {!friends.length && <p className="p-3 text-sm text-text-dim">Ajoute des amis depuis l’onglet Amis pour les inviter.</p>}
        <ul aria-label="Inviter des amis au vocal" className="space-y-2">{friends.map(friend => {
          const done = sent.has(`${room.id}:${room.instanceId}:${friend.id}`);
          return <li key={friend.id} className="flex items-center gap-2 rounded-xl bg-abyss/60 p-2">
            <Avatar username={friend.username} avatarUrl={friend.avatarUrl} size="sm" /><span className="min-w-0 flex-1 truncate text-xs">{friend.username}</span>
            <button type="button" className={button} disabled={Boolean(inviting) || done || voice.members.length >= VOICE_CAPACITY} onClick={() => void invite(friend.id)} aria-label={`Inviter ${friend.username} au vocal`}>{done ? "Envoyée" : inviting === friend.id ? "Envoi…" : "Inviter"}</button>
          </li>;
        })}</ul>
      </>}
      {panel === "rooms" && <>
        <ul className="space-y-2">{rooms.map(other => <li key={other.id} className="flex items-center gap-3 rounded-xl bg-abyss/60 p-3">
          <Avatar username={other.hostName} avatarUrl={other.hostAvatar} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{other.title}</p><p className="text-xs text-text-faint">{other.hostName} · {other.count}/{VOICE_CAPACITY}</p></div><span className="text-[10px] text-cyan">{other.id === room.id ? "Ta salle" : other.visibility === "public" ? "Publique" : "Amis"}</span>
        </li>)}</ul>
        <p className="mt-3 text-xs text-text-faint">Quitte ton vocal pour rejoindre une autre salle.</p>
        <Link href="/friends" className="mt-2 inline-flex min-h-11 items-center text-sm text-cyan">Retrouver mes amis</Link>
      </>}
    </RoomPanel>}
  </div>;
}
