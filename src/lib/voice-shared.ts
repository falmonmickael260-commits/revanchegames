export const VOICE_PREFIX = "rg-social-";
export const VOICE_CAPACITY = 8;
export type VoiceRoom = { id: string; title: string; hostId: string; hostName: string; count: number; visibility: "public" | "friends"; hostAvatar: string | null; locked: boolean; instanceId?: string };
export const VOICE_CHAT_TOPIC = "rg-social-chat-v1";

export function voiceMetadata(name: string, metadata: string): Omit<VoiceRoom, "count"> | null {
  if (!/^rg-social-[0-9a-f-]{36}$/.test(name)) return null;
  try {
    const value = JSON.parse(metadata);
    if (value.kind !== "rg-social-voice-v1" || typeof value.hostId !== "string" ||
      typeof value.hostName !== "string" || typeof value.title !== "string") return null;
    if (name !== VOICE_PREFIX + value.hostId) return null;
    return { id: name, hostId: value.hostId, hostName: value.hostName, title: value.title,
      visibility: value.visibility === "public" ? "public" : "friends", hostAvatar: typeof value.hostAvatar === "string" ? value.hostAvatar : null,
      locked: value.hasPasscode === true };
  } catch { return null; }
}

export function canJoinVoice(room: Pick<VoiceRoom, "hostId"> & Partial<Pick<VoiceRoom, "visibility">>, userId: string, friendIds: Set<string>, blockedIds = new Set<string>()) {
  return !blockedIds.has(room.hostId) && (room.visibility === "public" || room.hostId === userId || friendIds.has(room.hostId));
}

export function voiceAvatar(metadata: string | undefined): string | null {
  try { const value = JSON.parse(metadata || "{}"); return typeof value.avatarUrl === "string" && value.avatarUrl.length <= 2048 ? value.avatarUrl : null; }
  catch { return null; }
}

export function readVoiceChat(payload: Uint8Array): { id: string; body: string } | null {
  if (payload.byteLength > 4096) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(payload));
    if (typeof value.id !== "string" || !/^[0-9a-f-]{36}$/.test(value.id) || typeof value.body !== "string" || !value.body.trim() || value.body.length > 500) return null;
    return { id: value.id, body: value.body.trim() };
  } catch { return null; }
}
