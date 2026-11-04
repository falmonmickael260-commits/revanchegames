"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { useSocial } from "@/components/social/SocialProvider";
import { readVoiceChat, voiceAvatar, VOICE_CHAT_TOPIC, VOICE_GIFT_TOPIC, type VoiceRoom } from "@/lib/voice-shared";
import type { ChatMessage } from "@/lib/chat-shared";
import { celebrateGift, type GiftEvent } from "@/lib/gifts/types";

type Member = { id: string; name: string; avatarUrl: string | null; speaking: boolean; muted: boolean };
type VoiceState = {
  current: VoiceRoom | null; members: Member[]; busy: boolean; muted: boolean;
  reconnecting: boolean; error: string; needsAudio: boolean;
  messages: ChatMessage[]; sending: boolean; chatError: string;
  giftEvents: GiftEvent[];
  sendMessage: (body: string) => Promise<boolean>;
  join: (action: "create" | "join" | "joinInvitation", value: string, visibility?: "public" | "friends", passcode?: string) => Promise<void>;
  leave: () => void; toggleMic: () => Promise<void>; enableAudio: () => Promise<void>;
};
const VoiceContext = createContext<VoiceState | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { me } = useSocial();
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
  const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([]);
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
    setMessages([]); setGiftEvents([]); setChatError(""); setSending(false); sendingRef.current = false; receivedAt.current.clear();
  }, []);

  // Stop capture and subscriptions on logout/account switch and on unmount.
  useEffect(() => () => leave(), [me?.id, leave]);

  const join = useCallback(async (action: "create" | "join" | "joinInvitation", value: string, visibility: "public" | "friends" = "public", passcode?: string) => {
    if (connection.current || busy) return;
    const attempt = ++epoch.current;
    setError(""); setBusy(true);
    let room: Room | null = null;
    try {
      const response = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "create" ? { action, title: value, visibility, passcode: passcode || undefined } : action === "joinInvitation" ? { action, messageId: value } : { action, roomId: value, passcode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      if (attempt !== epoch.current) return;
      const { Room: LiveRoom, RoomEvent, Track } = await import("livekit-client");
      if (attempt !== epoch.current) return;
      room = new LiveRoom({ adaptiveStream: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true } });
      const live = room;
      connection.current = live;
      const refreshGiftEvents = async () => {
        try {
          const response = await fetch(`/api/gifts/room?roomId=${encodeURIComponent(data.room.id)}`, { cache: "no-store" });
          if (!response.ok || connection.current !== live) return;
          const result = await response.json() as { events: GiftEvent[] };
          setGiftEvents(previous => {
            const known = new Set(previous.map(item => item.id));
            return [...previous, ...result.events.filter(item => !known.has(item.id))].slice(-100);
          });
        } catch { /* historique conservé côté serveur, prochain retour visible */ }
      };
      const update = () => {
        if (connection.current !== live) return;
        setMembers([live.localParticipant, ...live.remoteParticipants.values()]
          .sort((a, b) => a.identity === data.room.hostId ? -1 : b.identity === data.room.hostId ? 1 : a.identity.localeCompare(b.identity)).map(p => ({
          id: p.identity, name: p.name || "Joueur", avatarUrl: voiceAvatar(p.metadata), speaking: p.isSpeaking, muted: !p.isMicrophoneEnabled,
        })));
        setMuted(!live.localParticipant.isMicrophoneEnabled);
      };
      live.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (connection.current !== live) return;
        if (topic === VOICE_GIFT_TOPIC) {
          try {
            const value = JSON.parse(new TextDecoder().decode(payload));
            if (typeof value.id !== "string" || !/^[0-9a-f-]{36}$/.test(value.id)) return;
            void fetch(`/api/gifts/events?id=${encodeURIComponent(value.id)}`, { cache: "no-store" }).then(async response => {
              if (!response.ok || connection.current !== live) return;
              const gift = await response.json() as GiftEvent;
              setGiftEvents(previous => previous.some(item => item.id === gift.id) ? previous : [...previous, gift].slice(-100));
              if (gift.senderId !== live.localParticipant.identity) celebrateGift(gift);
            }).catch(() => {});
          } catch { /* signal invalide ignoré ; le serveur reste la source de vérité */ }
          return;
        }
        if (!participant || topic !== VOICE_CHAT_TOPIC) return;
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
      live.on(RoomEvent.Reconnected, () => { setReconnecting(false); update(); void refreshGiftEvents(); });
      live.on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudio(!live.canPlaybackAudio));
      live.on(RoomEvent.Disconnected, () => {
        if (connection.current === live) { leave(); setError("Tu as quitté le salon vocal. Tu peux le rejoindre à nouveau."); }
      });
      await live.connect(data.serverUrl, data.token);
      if (attempt !== epoch.current) { await live.disconnect(); return; }
      setCurrent(data.room); update();
      void refreshGiftEvents();
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
    messages, giftEvents, sending, chatError, sendMessage }}>
    {children}
    <div ref={audio} className="hidden" aria-hidden="true" />

  </VoiceContext.Provider>;
}

export function useVoice() {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("VoiceProvider manquant");
  return value;
}
