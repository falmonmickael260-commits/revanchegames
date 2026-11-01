"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useVoice } from "./VoiceProvider";

export function VoiceInvitation({ id, roomId, expiresAt, own = false, onJoined }: {
  id: string; roomId: string; expiresAt: string; own?: boolean; onJoined?: () => void;
}) {
  const voice = useVoice();
  const router = useRouter();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const check = () => setExpired(Date.parse(expiresAt) <= Date.now());
    const first = setTimeout(check, 0), timer = setInterval(check, 5000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [expiresAt]);
  if (own) return <p className="mt-2 text-xs text-text-dim">Invitation au salon vocal envoyée.</p>;
  if (expired) return <p className="mt-2 text-xs text-text-dim">Invitation au vocal expirée.</p>;
  const otherRoom = voice.current && voice.current.id !== roomId;
  return <div className="mt-2 space-y-2 rounded-xl border border-cyan/30 bg-cyan/5 p-3">
    <button type="button" disabled={voice.busy || Boolean(otherRoom)} className="min-h-11 rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-void disabled:opacity-50"
      onClick={async () => {
        if (voice.current?.id !== roomId) await voice.join("joinInvitation", id);
        router.push("/voice"); onJoined?.();
      }}>{voice.busy ? "Connexion…" : voice.current?.id === roomId ? "Ouvrir le salon" : "Rejoindre le salon vocal"}</button>
    {otherRoom && <p className="text-xs text-text-dim">Quitte ton vocal actuel pour rejoindre cette salle.</p>}
  </div>;
}
