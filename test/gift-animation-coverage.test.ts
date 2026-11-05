import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { giftAnimationPlan } from "../src/lib/gifts/animation-plan";

const root = process.cwd();

test("les 24 cadeaux ont une image, un style d'animation et une scène dédiée", async () => {
  const [migration, css, scenes, particles, layer, assets] = await Promise.all([
    readFile(`${root}/supabase/migrations/20261105000000_virtual_gifts_schema.sql`, "utf8"),
    readFile(`${root}/src/app/gifts.css`, "utf8"),
    readFile(`${root}/src/components/gifts/GiftCinematicScene.tsx`, "utf8"),
    readFile(`${root}/src/components/gifts/GiftSceneParticles.tsx`, "utf8"),
    readFile(`${root}/src/components/gifts/GiftCelebrationLayer.tsx`, "utf8"),
    readdir(`${root}/public/gifts`),
  ]);
  const gifts = [...migration.matchAll(/^\('([^']+)',.*,'([^']+)','(?:common|uncommon|rare|epic|legendary)'\)(?:,|;)?$/gm)]
    .map(match => ({ id: match[1], animation: match[2] }));

  assert.equal(gifts.length, 24);
  assert.equal(new Set(gifts.map(gift => gift.animation)).size, 24);
  for (const gift of gifts) {
    assert.ok(assets.includes(`${gift.id}.webp`), `image manquante : ${gift.id}`);
    assert.ok(css.includes(`data-animation="${gift.animation}"`), `animation CSS manquante : ${gift.animation}`);
    if (gift.animation === "firework") {
      assert.ok(layer.includes('animation_type === "firework"') && layer.includes("GiftFireworkAnimation"));
      assert.ok(css.includes("@keyframes rg-gift-firework"));
    } else {
      assert.ok(scenes.includes(`case "${gift.animation}"`), `scène SVG manquante : ${gift.animation}`);
      assert.ok(particles.includes(`${gift.animation}${gift.animation.includes("-") ? '"' : ""}:[`), `chorégraphie Canvas manquante : ${gift.animation}`);
      assert.ok(css.includes(`data-scene="${gift.animation}"] .rg-gift-scene-hero { animation-name:rg-hero-`), `trajectoire dédiée manquante : ${gift.animation}`);
    }
  }
});

test("la durée et la taille de scène augmentent avec le prix", () => {
  assert.deepEqual(giftAnimationPlan(30), { level: "small", duration: 2500 });
  assert.deepEqual(giftAnimationPlan(100), { level: "medium", duration: 4400 });
  assert.deepEqual(giftAnimationPlan(250), { level: "large", duration: 5600 });
  assert.deepEqual(giftAnimationPlan(500), { level: "prestige", duration: 7200 });
});
