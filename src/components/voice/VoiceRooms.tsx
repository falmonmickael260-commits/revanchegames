"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSocial } from "@/components/social/SocialProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { useVoice } from "./VoiceProvider";
import { VOICE_CAPACITY, type VoiceRoom } from "@/lib/voice-shared";

export function VoiceRooms() {
  const { me, ready } = useSocial();
  const voice = useVoice();
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
  }, [me?.id, me, refresh, voice.current?.id]);

  const button = "min-h-11 rounded-xl border border-border-soft bg-surface-raised px-4 py-2 text-sm disabled:opacity-40";
  return <div className="mx-auto max-w-4xl px-4 py-6 pb-52 sm:px-6 lg:px-8">
    <PageHeader eyebrow="Communauté" title="Salons vocaux" subtitle="Crée une salle éphémère et discute avec tes amis. Le créateur devient hôte." />
    {!ready ? <p className="mt-6" role="status">Chargement…</p> : !me ? <p className="mt-6">Connecte-toi pour créer ou rejoindre une salle. <Link href="/sign-in?next=/voice" className="text-cyan">Se connecter</Link></p> : <>
      <p className="mt-4 text-sm text-text-dim">Les amis de l’hôte peuvent rejoindre sans code. Jusqu’à {VOICE_CAPACITY} personnes. Le micro est coupé à l’entrée et la salle disparaît après une minute vide.</p>
      {(error || voice.error) && <p role="alert" className="mt-4 rounded-xl border border-rose-400/40 p-3 text-sm text-rose-300">{voice.error || error}</p>}
      {voice.current ? <section aria-label="Ta salle vocale" className="mt-6 rounded-2xl border border-cyan/40 bg-surface p-5">
        <h2 className="text-lg font-semibold">{voice.current.title}</h2>
        <p className="mt-1 text-sm text-text-dim">Hôte : {voice.current.hostName} {voice.current.hostId === me.id && "(toi)"}</p>
        <ul className="my-4 space-y-2" aria-label="Participants">
          {voice.members.map(member => <li key={member.id} className={member.speaking ? "text-cyan" : "text-text-dim"}>
            {member.name}{member.id === voice.current?.hostId ? " · Hôte" : ""} · {member.muted ? "Micro coupé" : member.speaking ? "Parle" : "Micro actif"}
          </li>)}
        </ul>
        <div className="flex flex-wrap gap-3">
          <button className={button} onClick={() => void voice.toggleMic()}>{voice.muted ? "Activer le micro" : "Couper le micro"}</button>
          {voice.needsAudio && <button className={button} onClick={() => void voice.enableAudio()}>Activer le son</button>}
          <button className={button} onClick={voice.leave}>Quitter la salle</button>
        </div>
        <p className="mt-4 text-sm text-text-faint">Tes amis retrouvent cette salle dans leur onglet Salons vocaux.</p>
      </section> : <form className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-border-soft bg-surface p-5" onSubmit={event => { event.preventDefault(); void voice.join("create", title); }}>
        <label className="min-w-0 flex-1">Nom de la salle<input required maxLength={60} value={title} onChange={event => setTitle(event.target.value)} placeholder="Le vocal des amis" className="mt-2 block min-h-11 w-full rounded-xl border border-border-soft bg-abyss px-3" /></label>
        <button className={button + " self-end text-cyan"} disabled={voice.busy || Boolean(error) || !title.trim()}>{voice.busy ? "Connexion…" : "Créer une salle éphémère"}</button>
      </form>}
      <h2 className="mt-8 text-lg font-semibold">Salles de tes amis</h2>
      {loading ? <p className="mt-4" role="status">Chargement des salles…</p> : rooms.length === 0 && !error ? <p className="mt-4 text-text-dim">Aucune salle ouverte pour le moment.</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{rooms.map(room => <section key={room.id} className="rounded-2xl border border-border-soft bg-surface p-5">
        <h3 className="font-semibold">{room.title}</h3>
        <p className="my-3 text-sm text-text-dim">Hôte : {room.hostName} · {room.count}/{VOICE_CAPACITY} personnes</p>
        <button className={button} disabled={voice.busy || Boolean(voice.current) || room.count >= VOICE_CAPACITY} onClick={() => void voice.join("join", room.id)}>{room.count >= VOICE_CAPACITY ? "Salle complète" : "Rejoindre le vocal"}</button>
      </section>)}</div>
      <Link href="/friends" className="mt-6 inline-block min-h-11 text-cyan">Retrouver mes amis</Link>
    </>}
  </div>;
}
