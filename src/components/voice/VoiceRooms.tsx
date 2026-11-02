"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Lock } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { requestPushDelivery } from "@/lib/push-client";
import { useVoice } from "./VoiceProvider";
import { ActiveVoiceRoom } from "./ActiveVoiceRoom";
import { VOICE_CAPACITY, type VoiceRoom } from "@/lib/voice-shared";

export function VoiceRooms() {
  const { me, ready } = useSocial();
  const voice = useVoice();
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [title, setTitle] = useState("");
  const [passcode, setPasscode] = useState("");
  const [joiningRoom, setJoiningRoom] = useState<VoiceRoom | null>(null);
  const [joinPasscode, setJoinPasscode] = useState("");
  const passcodeDialog = useRef<HTMLDialogElement>(null);
  const passcodeInput = useRef<HTMLInputElement>(null);
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState("");
  useEffect(() => {
    const dialog = passcodeDialog.current;
    if (joiningRoom && dialog && !dialog.open) { dialog.showModal(); passcodeInput.current?.focus(); }
    if (!joiningRoom && dialog?.open) dialog.close();
  }, [joiningRoom]);
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
  if (voice.current && me) return <ActiveVoiceRoom key={voice.current.instanceId || voice.current.id} rooms={rooms} invite={invite} inviting={inviting} sent={sent} inviteError={inviteError} />;
  return <div className="mx-auto max-w-5xl px-4 py-6 pb-52 sm:px-6 lg:px-8">
    <PageHeader eyebrow="Communauté" title="Salons vocaux" subtitle="Un salon, des voix, un chat : retrouve tes amis ou fais de nouvelles rencontres." />
    {!ready ? <p className="mt-6" role="status">Chargement…</p> : !me ? <p className="mt-6">Connecte-toi pour créer ou rejoindre une salle. <Link href="/sign-in?next=/voice" className="text-cyan">Se connecter</Link></p> : <>
      {(error || voice.error) && <p role="alert" className="mt-4 rounded-xl border border-rose-400/40 p-3 text-sm text-rose-300">{voice.error || error}</p>}
      <form className="mt-6 space-y-4 rounded-2xl border border-border-soft bg-surface p-5" onSubmit={event => { event.preventDefault(); void voice.join("create", title, visibility, passcode); }}>
        <div className="flex items-center gap-3"><Headphones className="h-6 w-6 text-cyan" /><h2 className="font-semibold">Créer ta salle éphémère</h2></div>
        <label className="block text-sm">Nom de la salle<input required maxLength={60} value={title} onChange={event => setTitle(event.target.value)} placeholder="Le salon des amis" className="mt-2 block min-h-11 w-full rounded-xl border border-border-soft bg-abyss px-3 text-base" /></label>
        <label className="block text-sm">Qui peut rejoindre ?<select value={visibility} onChange={event => setVisibility(event.target.value as "public" | "friends")} className="mt-2 block min-h-11 w-full rounded-xl border border-border-soft bg-abyss px-3 text-base"><option value="public">Tous les membres · Salle publique</option><option value="friends">Mes amis uniquement</option></select></label>
        <label className="block text-sm">Code d’accès à 4 chiffres <span className="text-text-faint">(facultatif)</span><input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" maxLength={4} value={passcode} onChange={event => setPasscode(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Ex. 2048" aria-describedby="voice-passcode-help" className="mt-2 block min-h-11 w-full rounded-xl border border-border-soft bg-abyss px-3 text-base tracking-[0.35em]" /><small id="voice-passcode-help" className="mt-1 block text-xs text-text-faint">Les joueurs invités directement pourront toujours te rejoindre sans saisir le code.</small></label>
        <p className="text-xs text-text-faint">Tu deviens hôte. Jusqu’à {VOICE_CAPACITY} personnes, micro coupé à l’entrée. La salle disparaît après une minute vide.</p>
        <button className={button + " w-full text-cyan sm:w-auto"} disabled={voice.busy || Boolean(error) || !title.trim() || Boolean(passcode && passcode.length !== 4)}>{voice.busy ? "Connexion…" : "Créer une salle éphémère"}</button>
      </form>
      <h2 className="mt-8 text-lg font-semibold">Salles à rejoindre</h2>
      <p className="mt-1 text-sm text-text-dim">Découvre les salles publiques et les salles de tes amis.</p>
      {loading ? <p className="mt-4" role="status">Chargement des salles…</p> : rooms.length === 0 && !error ? <p className="mt-4 text-text-dim">Aucune salle ouverte. Crée la première !</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{rooms.map(room => <section key={room.id} className={`rg-voice-listing${room.locked ? " is-locked" : ""}`}>
        <div className="flex items-center gap-3"><Avatar username={room.hostName} avatarUrl={room.hostAvatar} /><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{room.title}</h3><p className="mt-1 text-xs text-text-dim">{room.hostName} · Hôte</p></div>{room.locked && <Lock className="h-4 w-4 shrink-0 text-violet-soft" aria-label="Code d’accès requis" />}</div>
        <p className="my-3 text-xs text-text-dim">{room.visibility === "public" ? "Publique" : "Amis uniquement"} · {room.count}/{VOICE_CAPACITY} personnes{room.locked ? " · Code requis" : ""}</p>
        <button type="button" className={button + " w-full"} disabled={voice.busy || Boolean(voice.current) || room.count >= VOICE_CAPACITY} onClick={() => room.locked ? (setJoinPasscode(""), setJoiningRoom(room)) : void voice.join("join", room.id)}>{room.count >= VOICE_CAPACITY ? "Salle complète" : room.locked ? "Saisir le code" : "Rejoindre le vocal"}</button>
      </section>)}</div>
      <dialog ref={passcodeDialog} className="rg-passcode-dialog" onCancel={event => { event.preventDefault(); setJoiningRoom(null); }} onClick={event => { if (event.target === event.currentTarget) setJoiningRoom(null); }}>
        <form className="rg-passcode-card" onSubmit={event => { event.preventDefault(); if (joiningRoom) void voice.join("join", joiningRoom.id, "public", joinPasscode); }}>
          <span className="rg-passcode-icon"><Lock /></span><p className="rg-eyebrow">Salon protégé</p><h2>Code d’accès</h2><p className="rg-passcode-room">{joiningRoom?.title}</p>
          <label className="sr-only" htmlFor="voice-join-passcode">Code d’accès à quatre chiffres</label><input ref={passcodeInput} id="voice-join-passcode" type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} required value={joinPasscode} onChange={event => setJoinPasscode(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" aria-describedby={voice.error ? "voice-join-error" : undefined} />
          {voice.error && <p id="voice-join-error" className="rg-passcode-error" role="alert">{voice.error}</p>}
          <button type="submit" disabled={voice.busy || joinPasscode.length !== 4}>{voice.busy ? "Connexion…" : "Rejoindre le salon"}</button><button type="button" className="rg-passcode-cancel" onClick={() => setJoiningRoom(null)}>Annuler</button>
        </form>
      </dialog>
      <Link href="/friends" className="mt-6 inline-block min-h-11 text-cyan">Retrouver mes amis</Link>
    </>}
  </div>;
}
