"use client";

import { Armchair, Crown, Mic, MicOff } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { VOICE_CAPACITY } from "@/lib/voice-shared";
import type { useVoice } from "./VoiceProvider";

/** Visual seats only: entering a room or tapping a seat never enables a microphone. */
export function VoiceSeats({ members, hostId, compact = false, onMember, onInvite }: {
  members: ReturnType<typeof useVoice>["members"]; hostId: string; compact?: boolean;
  onMember?: () => void; onInvite?: () => void;
}) {
  return <ul aria-label={compact ? "Sièges de la salle" : "Participants"} className={`grid grid-cols-4 ${compact ? "gap-x-2 gap-y-2" : "gap-x-2 gap-y-5 py-3"}`}>
    {Array.from({ length: VOICE_CAPACITY }, (_, index) => {
      const member = members[index];
      const host = member?.id === hostId;
      const state = member ? member.muted ? "Micro coupé" : member.speaking ? "Parle" : "Micro actif" : "Place libre";
      const label = `Siège ${index + 1} · ${member?.name || "Libre"}${host ? " · Hôte" : ""} · ${state}`;
      return <li key={`seat-${index}`} aria-label={label} className="flex min-w-0 flex-col items-center text-center">
        <button type="button" onClick={member ? onMember : onInvite} disabled={member ? !onMember : !onInvite}
          aria-label={member ? label : `Inviter à la place ${index + 1}`} title={label}
          className={`relative flex shrink-0 items-center justify-center rounded-full border transition-shadow disabled:cursor-default ${compact ? "h-10 w-10" : "h-[68px] w-[68px]"} ${member?.speaking ? "border-cyan bg-cyan/10 ring-2 ring-cyan/70 shadow-[0_0_16px_var(--rg-cyan)]" : member ? "border-violet/40 bg-surface-raised" : "border-dashed border-border-soft bg-abyss/60 text-text-faint"}`}>
          {member ? <Avatar username={member.name} avatarUrl={member.avatarUrl} size={compact ? "sm" : "md"} /> : <Armchair className={compact ? "h-4 w-4" : "h-6 w-6"} />}
          {host && <Crown aria-label="Hôte" className={`absolute -top-2.5 left-1/2 -translate-x-1/2 fill-amber-300 text-amber-300 ${compact ? "h-3.5 w-3.5" : "h-5 w-5"}`} />}
          {member && <span className="absolute -bottom-0.5 -right-0.5 rounded-full border border-border-soft bg-abyss p-0.5">{member.muted ? <MicOff className="h-2.5 w-2.5 text-text-faint" /> : <Mic className="h-2.5 w-2.5 text-cyan" />}</span>}
        </button>
        <span title={member?.name || `Place ${index + 1}`} className={`mt-1 w-full ${compact ? "truncate text-[9px] leading-3" : "break-words text-[10px] leading-4"} ${member ? "font-semibold text-text-dim" : "text-text-faint"}`}>{member?.name || `Place ${index + 1}`}</span>
        {!compact && <span className={`mt-0.5 text-[9px] ${member?.speaking ? "text-cyan" : "text-text-faint"}`}>{host ? "Hôte · " : ""}{state}</span>}
      </li>;
    })}
  </ul>;
}
