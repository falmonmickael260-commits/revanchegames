export const GAME_SLUGS = ['kilomax', 'la-meute', 'quiz-master', 'president', '10000', 'camouflip'] as const;
export type ConnectedGame = typeof GAME_SLUGS[number];
export type NativeSession = { code: string; token?: string; playerId?: string; secret?: string; memberId?: number };
export type RoomSnapshot = { code: string; instance: string; capacity: number; count: number; status: 'open' | 'started' | 'closed' };
export type ConnectorCommand = {
  v: 1; game: ConnectedGame; operation: 'inspect' | 'admit'; room: string;
  uid: string; name: string; proof: NativeSession; inviter?: string; instance?: string; invitation?: string;
};
export function isConnectedGame(value: unknown): value is ConnectedGame {
  return typeof value === 'string' && (GAME_SLUGS as readonly string[]).includes(value);
}
export function validRoom(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(value);
}
