export type RewardBand = { rule: string; band: number; min_amount: number | null; max_amount: number | null;
  min_percent: number | null; max_percent: number | null; weight: number };

export function rewardBandBounds(price: number, band: RewardBand): [number, number] {
  if (price === 30) return [Number(band.min_amount), Number(band.max_amount)];
  return [Math.max(Math.ceil(price * 0.3), Math.ceil(price * Number(band.min_percent))),
    Math.min(Math.floor(price * 1.5), Math.floor(price * Number(band.max_percent)))];
}

/** Espérance exacte des bandes d'entiers, avant toute activation. */
export function theoreticalGiftReward(price: number, bands: RewardBand[]): { expected: number; returnPercent: number } | null {
  if (price === 10) return { expected: 0, returnPercent: 0 };
  const rule = price === 30 ? "thirty" : "general";
  const chosen = bands.filter(band => band.rule === rule && band.weight > 0);
  const weight = chosen.reduce((sum, band) => sum + band.weight, 0);
  if (!weight || chosen.some(band => { const [min,max] = rewardBandBounds(price, band); return min > max; })) return null;
  const expected = chosen.reduce((sum, band) => {
    const [min,max] = rewardBandBounds(price, band);
    return sum + ((min+max)/2) * band.weight / weight;
  }, 0);
  return { expected, returnPercent: expected / price * 100 };
}
