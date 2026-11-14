"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";

export function SupportLink() {
  const { me } = useSocial();
  const userId = me?.id;
  const [summary, setSummary] = useState<{ userId: string; unreadCount: number; isAdmin: boolean } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/support/tickets?summary=1", { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          if (!controller.signal.aborted) setSummary({ ...data, userId: userId! });
        }
      } catch { /* The link remains usable while notification status is unavailable. */ }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 30000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", focus); };
  }, [userId]);
  const current = summary?.userId === userId ? summary : null;
  return (
    <section className="rounded-xl border border-cyan/25 bg-surface p-4">
      <Link href="/settings/support" className="flex items-start gap-3">
        <LifeBuoy className="mt-1 h-5 w-5 shrink-0 text-cyan" />
        <div>
          <h2 className="font-display text-sm font-semibold text-text">Nous contacter / Assistance et litiges</h2>
          <p className="font-body text-xs text-text-faint">Paiements, remboursements, compte, jeux et signalements. Retrouve tes demandes et les réponses de l’équipe.</p>
          {!!current?.unreadCount && <p role="status" className="mt-2 text-sm text-cyan">{current.unreadCount} nouvelle(s) notification(s) d’assistance</p>}
        </div>
      </Link>
      {current?.isAdmin && <Link href="/admin" className="mt-3 inline-block text-sm text-amber">Panneau administrateur</Link>}
    </section>
  );
}
