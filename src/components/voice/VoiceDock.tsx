"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Headphones, Mic, MicOff } from "lucide-react";
import { useVoice } from "./VoiceProvider";

function VoiceControls({ onReduce }: { onReduce: () => void }) {
  const voice = useVoice();
  if (!voice.current) return null;
  return <>
    <div className="flex items-center gap-2">
      <Link href="/voice" className="min-w-0 flex-1 truncate font-semibold text-cyan" onClick={onReduce}>{voice.current.title} · {voice.members.length} en vocal</Link>
      <button type="button" onClick={onReduce} aria-label="Réduire le vocal" title="Réduire le vocal" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface-raised"><ChevronUp className="h-4 w-4" /></button>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => void voice.toggleMic()} className="inline-flex min-h-11 items-center gap-2">{voice.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-cyan" />}{voice.muted ? "Activer le micro" : "Couper le micro"}</button>
      {voice.needsAudio && <button type="button" onClick={() => void voice.enableAudio()} className="min-h-11 text-cyan">Activer le son</button>}
      <button type="button" onClick={voice.leave} className="min-h-11 text-rose-300">Quitter</button>
    </div>
    {voice.reconnecting && <p role="status">Reconnexion…</p>}
    {voice.error && <p role="alert" className="max-w-72 text-rose-300">{voice.error}</p>}
  </>;
}

/** The game keeps its full viewport: the collapsed voice button lives in its existing toolbar. */
export function VoiceGameControl() {
  const voice = useVoice();
  const [expanded, setExpanded] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const id = useId();
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setExpanded(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setExpanded(false); button.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [expanded]);
  if (!voice.current) return null;
  const reduce = () => { setExpanded(false); button.current?.focus(); };
  return <>
    <button ref={button} type="button" aria-label="Commandes du vocal" aria-expanded={expanded} aria-controls={expanded ? id : undefined}
      title={`Vocal · ${voice.members.length} · ${voice.muted ? "Micro coupé" : "Micro actif"}`}
      onClick={() => setExpanded(value => !value)}
      className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg px-1.5 ${voice.muted ? "text-text-dim" : "text-cyan"}`}>
      <Headphones className="h-4 w-4" /><span className="text-[10px] font-semibold">{voice.members.length}</span>
      {voice.muted && <MicOff className="h-3 w-3" />}
    </button>
    {expanded && createPortal(<aside ref={panel} id={id} aria-label="Commandes du vocal" className="fixed z-[70] w-72 max-w-[calc(100vw-16px)] rounded-xl border border-cyan/40 bg-abyss p-3 text-sm shadow-xl"
      style={{ top: "calc(var(--rg-game-bar-h) + 8px)", right: "calc(var(--rg-safe-right) + 8px)" }}>
      <VoiceControls onReduce={reduce} />
    </aside>, document.body)}
  </>;
}

export function VoiceDock() {
  const pathname = usePathname();
  const voice = useVoice();
  const [collapsed, setCollapsed] = useState(false);
  if (!voice.current || pathname === "/voice" || pathname.startsWith("/play/")) return null;
  return <aside aria-label="Vocal en cours" className="fixed right-3 z-[70] max-w-[calc(100vw-24px)] rounded-xl border border-cyan/40 bg-abyss p-2 text-sm shadow-xl" style={{ bottom: "calc(var(--rg-bottom-nav-h) + 12px)" }}>
    {collapsed ? <button type="button" onClick={() => setCollapsed(false)} aria-label="Agrandir le vocal" className="flex min-h-11 items-center gap-2 px-1 text-cyan"><Headphones className="h-4 w-4" /><span>{voice.members.length}</span><ChevronDown className="h-3 w-3" /></button> : <VoiceControls onReduce={() => setCollapsed(true)} />}
  </aside>;
}
