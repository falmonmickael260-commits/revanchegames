import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeBombshiftSaves, sanitizeBombshiftSave } from '../src/lib/bombshift-progress';

const progress = (score = 12000) => ({ cleared: true, bestScore: score, bestRank: 'SS', bestTimeMs: 100000, attempts: 2, wins: 1, secrets: ['level-40-s1'], objectivesSeen: 6 });
const save = (maps: Record<string, unknown>, unlockedMaps = 40) => ({
  schema: 3, unlockedMaps, maps, settings: {}, stats: {}, abilities: {},
});

test('accepts all 140 canonical map IDs, including mirrors 120, 130 and 140', () => {
  const ids = ['volcano','ice','temple','volcano2','ice2','temple2','volcano3','ice3','temple3',
    ...Array.from({ length: 131 }, (_, i) => `level-${i + 10}`)];
  const raw = save(Object.fromEntries(ids.map((id) => [id, progress()])), 140);
  const restored = sanitizeBombshiftSave(raw)!;
  assert.equal(restored.unlockedMaps, 140);
  assert.equal(Object.keys(restored.maps).length, 140);
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
  const cleaned = sanitizeBombshiftSave(save({ volcano: progress(), 'level-141': progress(), 'level-9': progress(), unknown: progress() }, 999))!;
  assert.deepEqual(Object.keys(cleaned.maps), ['volcano']);
  assert.equal(cleaned.unlockedMaps, 140);
  assert.equal(sanitizeBombshiftSave(null), null);
});


test('retains wins in the new pack and restores level 60 on another device', () => {
  const firstDevice = save({ 'level-41': progress(14000), 'level-50': progress(15000), 'level-59': progress(16000) }, 60);
  const stored = JSON.parse(JSON.stringify(mergeBombshiftSaves(null, firstDevice)));
  const restored = mergeBombshiftSaves(stored, save({}, 1))!;
  assert.equal(restored.unlockedMaps, 60);
  for (const id of ['level-41', 'level-50', 'level-59']) assert.equal(restored.maps[id].cleared, true);
  assert.equal(restored.maps['level-50'].bestScore, 15000);
  const final = mergeBombshiftSaves(restored, save({ 'level-60': progress(18000) }, 60))!;
  assert.equal(final.maps['level-60'].cleared, true);
  assert.equal(final.maps['level-41'].cleared, true);
});


test('never turns a corrupted time into a one-millisecond ranking record', () => {
  for (const value of [-1, 0, null, "fast", Number.NaN, Number.POSITIVE_INFINITY, 90000000]) {
    assert.equal(sanitizeBombshiftSave(save({ volcano: {...progress(), bestTimeMs: value} }))!.maps.volcano.bestTimeMs, null);
  }
});


test('keeps records on level 110 after account merge with an older device', () => {
  const account = save({'level-80': progress(), 'level-110': {...progress(), bestTimeMs: 240000}}, 110);
  const merged = mergeBombshiftSaves(account, save({'level-80': {...progress(), bestTimeMs: 90000}}, 80))!;
  assert.equal(merged.unlockedMaps, 110);
  assert.equal(merged.maps['level-110'].bestTimeMs, 240000);
  assert.equal(merged.maps['level-80'].bestTimeMs, 90000);
});

test('retains level 140 when merging an older device', () => {
  const merged = mergeBombshiftSaves(save({'level-140': progress()}, 140), save({}, 1))!;
  assert.equal(merged.unlockedMaps, 140);
  assert.equal(merged.maps['level-140'].cleared, true);
});
