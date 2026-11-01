import type { InvitationOutcome } from './api';

export function invitationPath(result: InvitationOutcome): string {
  const base = `/play/${encodeURIComponent(result.game_slug)}`;
  if (result.invitation_id) return `${base}?invitation=${encodeURIComponent(result.invitation_id)}`;
  return result.room_code ? `${base}?room=${encodeURIComponent(result.room_code)}` : base;
}
