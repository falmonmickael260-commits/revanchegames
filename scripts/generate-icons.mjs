import sharp from "sharp";
import { readFileSync } from "fs";

const svg = readFileSync("public/icons/icon.svg");

const sizes = [
  { size: 192, file: "icon-192.png" },
  { size: 512, file: "icon-512.png" },
  { size: 180, file: "icon-180.png" },
  { size: 32, file: "favicon-32.png" },
];

for (const { size, file } of sizes) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(`public/icons/${file}`);
  console.log(`✓ ${file}`);
}

// Maskable variant: same art, slightly inset so the safe zone isn't clipped.
await sharp(svg, { density: 384 })
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: "#05070d" })
  .png()
  .toFile("public/icons/icon-maskable-512.png");
console.log("✓ icon-maskable-512.png");
