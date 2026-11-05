const MAP_IDS = new Set([
  "volcano", "ice", "temple", "volcano2", "ice2", "temple2", "volcano3", "ice3", "temple3",
]);
const RANKS = new Set(["C", "B", "A", "S", "SS", "SSS"]);
const EFFECTS = new Set(["low", "medium", "high"]);
const DIFFICULTIES = new Set(["detente", "normal", "veteran"]);
const RANK_SCORE: Record<string, number> = { C: 1, B: 2, A: 3, S: 4, SS: 5, SSS: 6 };

export type BombshiftSave = {
  schema: 3;
  unlockedMaps: number;
  maps: Record<string, {
    cleared: boolean;
    bestScore: number;
    bestRank: string | null;
    bestTimeMs: number | null;
    attempts: number;
    wins: number;
    secrets: string[];
    objectivesSeen: number;
  }>;
  settings: {
    sfxVolume: number;
    musicVolume: number;
    screenShake: boolean;
    effects: "low" | "medium" | "high";
    joystickSide: "left" | "right";
    joystickSize: number;
    showDangerHints: boolean;
    haptics: boolean;
    difficulty: "detente" | "normal" | "veteran";
    reduceFlashes: boolean;
  };
  stats: Record<string, number>;
  abilities: { shift: boolean; slow: boolean };
};

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const int = (value: unknown, min: number, max: number, fallback = min) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
const decimal = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const bool = (value: unknown) => value === true;

export function sanitizeBombshiftSave(value: unknown): BombshiftSave | null {
  if (!record(value) || !record(value.maps) || !record(value.settings) || !record(value.stats) || !record(value.abilities)) return null;
  const rawSettings = value.settings;
  const rawStats = value.stats;
  const rawAbilities = value.abilities;
  const maps: BombshiftSave["maps"] = {};

  for (const [mapId, raw] of Object.entries(value.maps)) {
    if (!MAP_IDS.has(mapId) || !record(raw)) continue;
    const secrets = Array.isArray(raw.secrets)
      ? [...new Set(raw.secrets.filter((item): item is string => typeof item === "string" && /^[a-z0-9_-]{1,48}$/.test(item)))].slice(0, 64)
      : [];
    maps[mapId] = {
      cleared: bool(raw.cleared),
      bestScore: int(raw.bestScore, 0, 10_000_000),
      bestRank: typeof raw.bestRank === "string" && RANKS.has(raw.bestRank) ? raw.bestRank : null,
      bestTimeMs: raw.bestTimeMs === null || raw.bestTimeMs === undefined ? null : int(raw.bestTimeMs, 1, 86_400_000, 1),
      attempts: int(raw.attempts, 0, 10_000_000),
      wins: int(raw.wins, 0, 10_000_000),
      secrets,
      objectivesSeen: int(raw.objectivesSeen, 0, 100),
    };
  }

  const statKeys = ["totalKills", "totalDeaths", "totalBombs", "totalBlocks", "totalPowerups", "totalPlaytimeMs", "runs"];
  const stats: Record<string, number> = {};
  for (const key of statKeys) stats[key] = int(rawStats[key], 0, 2_000_000_000);
  const difficulty = DIFFICULTIES.has(String(rawSettings.difficulty)) ? rawSettings.difficulty as BombshiftSave["settings"]["difficulty"] : "normal";
  const effects = EFFECTS.has(String(rawSettings.effects)) ? rawSettings.effects as BombshiftSave["settings"]["effects"] : "high";

  return {
    schema: 3,
    unlockedMaps: int(value.unlockedMaps, 1, 9),
    maps,
    settings: {
      sfxVolume: decimal(rawSettings.sfxVolume, 0, 1, 0.8),
      musicVolume: decimal(rawSettings.musicVolume, 0, 1, 0.45),
      screenShake: rawSettings.screenShake !== false,
      effects,
      joystickSide: rawSettings.joystickSide === "right" ? "right" : "left",
      joystickSize: decimal(rawSettings.joystickSize, 0.7, 1.4, 1),
      showDangerHints: rawSettings.showDangerHints !== false,
      haptics: rawSettings.haptics !== false,
      difficulty,
      reduceFlashes: bool(rawSettings.reduceFlashes),
    },
    stats,
    abilities: { shift: bool(rawAbilities.shift), slow: bool(rawAbilities.slow) },
  };
}

/** Merge local progress into the account copy without losing either device's best results. */
export function mergeBombshiftSaves(remote: unknown, local: unknown): BombshiftSave | null {
  const account = sanitizeBombshiftSave(remote);
  const device = sanitizeBombshiftSave(local);
  if (!account) return device;
  if (!device) return account;

  const maps: BombshiftSave["maps"] = {};
  for (const mapId of MAP_IDS) {
    const a = account.maps[mapId], b = device.maps[mapId];
    if (!a && !b) continue;
    const bestRank = !a?.bestRank ? b?.bestRank ?? null : !b?.bestRank ? a.bestRank
      : RANK_SCORE[a.bestRank] >= RANK_SCORE[b.bestRank] ? a.bestRank : b.bestRank;
    const times = [a?.bestTimeMs, b?.bestTimeMs].filter((time): time is number => time !== null && time !== undefined);
    maps[mapId] = {
      cleared: !!a?.cleared || !!b?.cleared,
      bestScore: Math.max(a?.bestScore ?? 0, b?.bestScore ?? 0),
      bestRank,
      bestTimeMs: times.length ? Math.min(...times) : null,
      attempts: Math.max(a?.attempts ?? 0, b?.attempts ?? 0),
      wins: Math.max(a?.wins ?? 0, b?.wins ?? 0),
      secrets: [...new Set([...(a?.secrets ?? []), ...(b?.secrets ?? [])])].slice(0, 64),
      objectivesSeen: Math.max(a?.objectivesSeen ?? 0, b?.objectivesSeen ?? 0),
    };
  }

  const stats: Record<string, number> = {};
  for (const key of Object.keys(account.stats)) stats[key] = Math.max(account.stats[key], device.stats[key] ?? 0);
  const merged = sanitizeBombshiftSave({
    ...account,
    unlockedMaps: Math.max(account.unlockedMaps, device.unlockedMaps),
    maps,
    stats,
    abilities: { shift: account.abilities.shift || device.abilities.shift, slow: account.abilities.slow || device.abilities.slow },
  });
  return merged;
}
