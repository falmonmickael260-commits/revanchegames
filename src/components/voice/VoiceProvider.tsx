"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { useSocial } from "@/components/social/SocialProvider";
import { readVoiceChat, voiceAvatar, VOICE_CHAT_TOPIC, type VoiceRoom } from "@/lib/voice-shared";
import type { ChatMessage } from "@/lib/chat-shared";

type Member = { id: string; name: string; avatarUrl: string | null; speaking: boolean; muted: boolean };
type VoiceState = {
  current: VoiceRoom | null; members: Member[]; busy: boolean; muted: boolean;
  reconnecting: boolean; error: string; needsAudio: boolean;
  messages: ChatMessage[]; sending: boolean; chatError: string;
  sendMessage: (body: string) => Promise<boolean>;
  join: (action: "create" | "join" | "joinInvitation", value: string, visibility?: "public" | "friends") => Promise<void>;
  leave: () => void; toggleMic: () => Promise<void>; enableAudio: () => Promise<void>;
};
const VoiceContext = createContext<VoiceState | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { me } = useSocial();
  const pathname = usePathname();
  const connection = useRef<Room | null>(null);
  const epoch = useRef(0);
  const audio = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<VoiceRoom | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState("");
  const [needsAudio, setNeedsAudio] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const sendingRef = useRef(false);
  const receivedAt = useRef(new Map<string, number>());

  const leave = useCallback(() => {
    epoch.current++;
    const room = connection.current;
    connection.current = null;
    void room?.disconnect();
    audio.current?.replaceChildren();
    setCurrent(null); setMembers([]); setMuted(true); setBusy(false); setReconnecting(false); setNeedsAudio(false);
    setMessages([]); setChatError(""); setSending(false); sendingRef.current = false; receivedAt.current.clear();
  }, []);

  // Stop capture and subscriptions on logout/account switch and on unmount.
  useEffect(() => () => leave(), [me?.id, leave]);

  const join = useCallback(async (action: "create" | "join" | "joinInvitation", value: string, visibility: "public" | "friends" = "public") => {
    if (connection.current || busy) return;
    const attempt = ++epoch.current;
    setError(""); setBusy(true);
    let room: Room | null = null;
    try {
      const response = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "create" ? { action, title: value, visibility } : action === "joinInvitation" ? { action, messageId: value } : { action, roomId: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      if (attempt !== epoch.current) return;
      const { Room: LiveRoom, RoomEvent, Track } = await import("livekit-client");
      if (attempt !== epoch.current) return;
      room = new LiveRoom({ adaptiveStream: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true } });
      const live = room;
      connection.current = live;
      const update = () => {
        if (connection.current !== live) return;
        setMembers([live.localParticipant, ...live.remoteParticipants.values()]
          .sort((a, b) => a.identity === data.room.hostId ? -1 : b.identity === data.room.hostId ? 1 : a.identity.localeCompare(b.identity)).map(p => ({
          id: p.identity, name: p.name || "Joueur", avatarUrl: voiceAvatar(p.metadata), speaking: p.isSpeaking, muted: !p.isMicrophoneEnabled,
        })));
        setMuted(!live.localParticipant.isMicrophoneEnabled);
      };
      live.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (connection.current !== live || !participant || topic !== VOICE_CHAT_TOPIC) return;
        const message = readVoiceChat(payload);
        if (!message) return;
        const last = receivedAt.current.get(participant.identity) || 0;
        if (Date.now() - last < 500) return;
        receivedAt.current.set(participant.identity, Date.now());
        const id = `${participant.identity}:${message.id}`;
        setMessages(previous => previous.some(m => m.id === id) ? previous : [...previous, {
          id, body: message.body, createdAt: new Date().toISOString(), userId: participant.identity,
          username: participant.name || "Joueur", avatarUrl: voiceAvatar(participant.metadata),
        }].slice(-100));
      });
      live.on(RoomEvent.ParticipantDisconnected, participant => receivedAt.current.delete(participant.identity));
      live.on(RoomEvent.TrackSubscribed, track => {
        if (track.kind === Track.Kind.Audio && connection.current === live) audio.current?.append(track.attach());
      });
      live.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(el => el.remove()));
      for (const event of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ActiveSpeakersChanged,
        RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantMetadataChanged]) live.on(event, update);
      live.on(RoomEvent.Reconnecting, () => setReconnecting(true));
      live.on(RoomEvent.Reconnected, () => { setReconnecting(false); update(); });
      live.on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudio(!live.canPlaybackAudio));
      live.on(RoomEvent.Disconnected, () => {
        if (connection.current === live) { leave(); setError("Tu as quitté le salon vocal. Tu peux le rejoindre à nouveau."); }
      });
      await live.connect(data.serverUrl, data.token);
      if (attempt !== epoch.current) { await live.disconnect(); return; }
      setCurrent(data.room); update();
      await live.startAudio().catch(() => setNeedsAudio(true));
    } catch (cause) {
      if (attempt === epoch.current) {
        leave(); setError(cause instanceof Error ? cause.message : "Connexion impossible.");
      } else { void room?.disconnect(); }
    } finally { if (attempt === epoch.current) setBusy(false); }
  }, [busy, leave]);

  const sendMessage = async (body: string) => {
    const live = connection.current;
    const text = body.trim();
    if (!live || !current || !text || text.length > 500 || sendingRef.current) return false;
    if (Date.now() - (receivedAt.current.get(live.localParticipant.identity) || 0) < 1000) {
      setChatError("Attends une seconde entre deux messages."); return false;
    }
    sendingRef.current = true; setSending(true); setChatError("");
    try {
      const id = crypto.randomUUID();
      await live.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ id, body: text })), { reliable: true, topic: VOICE_CHAT_TOPIC });
      if (connection.current !== live) return false;
      receivedAt.current.set(live.localParticipant.identity, Date.now());
      setMessages(previous => [...previous, { id: `${live.localParticipant.identity}:${id}`, body: text, createdAt: new Date().toISOString(),
        userId: live.localParticipant.identity, username: live.localParticipant.name || "Toi", avatarUrl: voiceAvatar(live.localParticipant.metadata) }].slice(-100));
      return true;
    } catch { if (connection.current === live) setChatError("Message non envoyé. Vérifie ta connexion."); return false; }
    finally { if (connection.current === live) { sendingRef.current = false; setSending(false); } }
  };

  const toggleMic = async () => {
    const room = connection.current;
    if (!room) return;
    setError("");
    try { await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled); setMuted(!room.localParticipant.isMicrophoneEnabled); }
    catch { setError("Autorise l’accès au microphone dans ton navigateur, puis réessaie."); }
  };
  const enableAudio = async () => {
    try { await connection.current?.startAudio(); setNeedsAudio(false); }
    catch { setError("Appuie à nouveau sur Activer le son pour écouter le salon."); }
  };

  return <VoiceContext.Provider value={{ current, members, busy, muted, reconnecting, error, needsAudio, join, leave, toggleMic, enableAudio,
    messages, sending, chatError, sendMessage }}>
    {children}
    <div ref={audio} className="hidden" aria-hidden="true" />
    {current && pathname !== "/voice" && <aside aria-label="Vocal en cours" className="fixed right-3 z-[70] max-w-[calc(100vw-24px)] rounded-xl border border-cyan/40 bg-abyss p-3 text-sm shadow-xl" style={{ bottom: "calc(var(--rg-bottom-nav-h) + 12px)" }}>
      <Link href="/voice" className="font-semibold text-cyan">{current.title} · {members.length} en vocal</Link>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" onClick={() => void toggleMic()} className="min-h-11">{muted ? "Activer le micro" : "Couper le micro"}</button>
        {needsAudio && <button type="button" onClick={() => void enableAudio()} className="min-h-11 text-cyan">Activer le son</button>}
        <button type="button" onClick={leave} className="min-h-11 text-rose-300">Quitter</button>
      </div>
      {reconnecting && <p role="status">Reconnexion…</p>}
      {error && <p role="alert" className="max-w-72 text-rose-300">{error}</p>}
    </aside>}
  </VoiceContext.Provider>;
}

export function useVoice() {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("VoiceProvider manquant");
  return value;
}
