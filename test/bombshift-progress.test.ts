import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeBombshiftSaves, sanitizeBombshiftSave } from '../src/lib/bombshift-progress';

const progress = (score = 12000) => ({ cleared: true, bestScore: score, bestRank: 'SS', bestTimeMs: 100000, attempts: 2, wins: 1, secrets: ['level-40-s1'], objectivesSeen: 6 });
const save = (maps: Record<string, unknown>, unlockedMaps = 40) => ({
  schema: 3, unlockedMaps, maps, settings: {}, stats: {}, abilities: {},
});

test('accepts all forty canonical map IDs, including mirror levels 10, 20, 30 and 40', () => {
  const ids = ['volcano','ice','temple','volcano2','ice2','temple2','volcano3','ice3','temple3',
    ...Array.from({ length: 31 }, (_, i) => `level-${i + 10}`)];
  const raw = save(Object.fromEntries(ids.map((id) => [id, progress()])));
  const restored = sanitizeBombshiftSave(raw)!;
  assert.equal(restored.unlockedMaps, 40);
  assert.equal(Object.keys(restored.maps).length, 40);
  for (const id of ids) assert.equal(restored.maps[id].cleared, true);
  assert.deepEqual(restored.maps['level-40'].secrets, ['level-40-s1']);
});

test('keeps a level-21 victory through JSON storage and account reload', () => {
  const incoming = save({ 'level-21': progress() }, 22);
  const stored = JSON.parse(JSON.stringify(mergeBombshiftSaves(null, incoming)));
  const reloaded = mergeBombshiftSaves(stored, save({}, 1))!;
  assert.equal(reloaded.maps['level-21'].cleared, true);
  assert.equal(reloaded.unlockedMaps, 22);
  assert.equal(reloaded.maps['level-21'].bestScore, 12000);
});

test('merges devices without losing a later level, best score or mirror completion', () => {
  const account = save({ 'level-30': progress(16000), 'level-40': progress(14000) });
  const staleDevice = save({ volcano: progress(7000), 'level-30': progress(5000) }, 31);
  const merged = mergeBombshiftSaves(account, staleDevice)!;
  assert.equal(merged.unlockedMaps, 40);
  assert.equal(merged.maps['level-30'].bestScore, 16000);
  assert.equal(merged.maps['level-40'].cleared, true);
  assert.equal(merged.maps.volcano.cleared, true);
});

test('keeps the nine original IDs and ignores unrelated or out-of-campaign IDs', () => {
  const cleaned = sanitizeBombshiftSave(save({ volcano: progress(), 'level-41': progress(), 'level-9': progress(), unknown: progress() }, 999))!;
  assert.deepEqual(Object.keys(cleaned.maps), ['volcano']);
  assert.equal(cleaned.unlockedMaps, 40);
  assert.equal(sanitizeBombshiftSave(null), null);
});
