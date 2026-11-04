import { test } from "node:test";
import assert from "node:assert/strict";
import { rewardBandBounds, theoreticalGiftReward, type RewardBand } from "@/lib/gifts/economy";

const bands: RewardBand[] = [
  { rule:"thirty",band:1,min_amount:1,max_amount:10,min_percent:null,max_percent:null,weight:70 },
  { rule:"thirty",band:2,min_amount:11,max_amount:20,min_percent:null,max_percent:null,weight:25 },
  { rule:"thirty",band:3,min_amount:21,max_amount:30,min_percent:null,max_percent:null,weight:5 },
  { rule:"general",band:1,min_amount:null,max_amount:null,min_percent:.3,max_percent:.4999,weight:65 },
  { rule:"general",band:2,min_amount:null,max_amount:null,min_percent:.5,max_percent:.9999,weight:30 },
  { rule:"general",band:3,min_amount:null,max_amount:null,min_percent:1,max_percent:1.5,weight:5 },
];

test("règles de renta, bornes entières et rendements documentables", () => {
  assert.deepEqual(theoreticalGiftReward(10,bands), { expected:0, returnPercent:0 });
  assert.equal(theoreticalGiftReward(30,bands)?.expected, 9);
  for (const [price,min,max] of [[50,15,75],[100,30,150],[250,75,375],[500,150,750],[520,156,780]]) {
    const ranges = bands.filter(band => band.rule === "general").map(band => rewardBandBounds(price,band));
    assert.equal(ranges[0][0],min);
    assert.equal(ranges.at(-1)?.[1],max);
    assert.ok(ranges.every(([a,b]) => a <= b));
    assert.ok((theoreticalGiftReward(price,bands)?.returnPercent ?? 0) < 60);
  }
  assert.equal(theoreticalGiftReward(500,bands)?.expected,273.275);
});
