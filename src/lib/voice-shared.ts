export const VOICE_PREFIX = "rg-social-";
export const VOICE_CAPACITY = 8;
export type VoiceRoom = { id: string; title: string; hostId: string; hostName: string; count: number };

export function voiceMetadata(name: string, metadata: string): Omit<VoiceRoom, "count"> | null {
  if (!/^rg-social-[0-9a-f-]{36}$/.test(name)) return null;
  try {
    const value = JSON.parse(metadata);
    if (value.kind !== "rg-social-voice-v1" || typeof value.hostId !== "string" ||
      typeof value.hostName !== "string" || typeof value.title !== "string") return null;
    if (name !== VOICE_PREFIX + value.hostId) return null;
    return { id: name, hostId: value.hostId, hostName: value.hostName, title: value.title };
  } catch { return null; }
}

export function canJoinVoice(room: Pick<VoiceRoom, "hostId">, userId: string, friendIds: Set<string>) {
  return room.hostId === userId || friendIds.has(room.hostId);
}
