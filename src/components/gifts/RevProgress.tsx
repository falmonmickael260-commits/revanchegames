"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type RevProgressRow = {
  total_rev: number;
  level: number;
  level_label: string;
  level_start: number;
  next_total: number | null;
};

export function RevProgress({ userId, initial }: { userId: string; initial: RevProgressRow | null }) {
  const [progress, setProgress] = useState(initial);
  const [levelUp, setLevelUp] = useState(false);
  const lastLevel = useRef(initial?.level ?? 1);
  const channelId = useId().replace(/[^a-zA-Z0-9]/g, "");
  useEffect(() => {
    const db = createClient();
    let active = true;
    const refresh = async () => {
      const { data } = await db.rpc("get_rev_progress", { p_user_id: userId });
      const next = (data?.[0] ?? null) as RevProgressRow | null;
      if (!active || !next) return;
      if (next.level > lastLevel.current) setLevelUp(true);
      lastLevel.current = next.level;
      setProgress(next);
    };
    const channel = db.channel(`rg-rev-${userId}-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gift_received_events", filter: `recipient_id=eq.${userId}` }, () => { void refresh(); })
      .subscribe();
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    return () => { active = false; document.removeEventListener("visibilitychange", resume); void db.removeChannel(channel); };
  }, [userId, channelId]);
  useEffect(() => {
    if (!levelUp) return;
    const timer = setTimeout(() => setLevelUp(false), 2100);
    return () => clearTimeout(timer);
  }, [levelUp]);
  const total = Number(progress?.total_rev ?? 0);
  const start = Number(progress?.level_start ?? 0);
  const next = progress?.next_total == null ? null : Number(progress.next_total);
  const percent = next && next > start ? Math.max(0, Math.min(100, Math.round((total-start)/(next-start)*100))) : 100;
  return <section className={`rg-rev-progress ${levelUp ? "is-level-up" : ""}`} aria-label="Progression REV">
    <div className="rg-rev-heading"><span><Sparkles size={17} /> NIVEAU REV <strong>{progress?.level ?? 1}</strong></span><span>{total.toLocaleString("fr-FR")} REV</span></div>
    <div className="rg-rev-track" role="progressbar" aria-label="Progression vers le prochain niveau REV" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div>
    <p>{next === null ? "Dernier palier configuré atteint" : `${Math.max(0,next-total).toLocaleString("fr-FR")} REV avant le niveau ${(progress?.level ?? 1)+1}`}</p>
  </section>;
}
