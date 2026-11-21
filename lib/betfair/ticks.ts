// Betfair's price ladder. Prices move in steps ("ticks") whose size depends on
// the price:  1.01-2 by 0.01 (100 ticks), 2-3 by 0.02 (50), 3-4 by 0.05 (20),
// 4-6 by 0.1 (20), 6-10 by 0.2 (20), 10-20 by 0.5 (20), 20-30 by 1 (10),
// 30-50 by 2 (10), 50-100 by 5 (10), 100-1000 by 10 (90).

const BANDS: [lo: number, hi: number, step: number][] = [
  [1.01, 2, 0.01], [2, 3, 0.02], [3, 4, 0.05], [4, 6, 0.1], [6, 10, 0.2],
  [10, 20, 0.5], [20, 30, 1], [30, 50, 2], [50, 100, 5], [100, 1000, 10],
]

// Position of a price on the ladder: 1.01 is 0, 2.00 is 99, 3.00 is 149, 1000 is 349.
// Prices between two ticks (a starting price, say) get a fractional position.
export function tickIndex(price: number): number {
  let idx = 0
  for (const [lo, hi, step] of BANDS) {
    if (price <= hi) return idx + Math.max(0, price - lo) / step
    idx += Math.round((hi - lo) / step)
  }
  return idx
}

// Ticks from price a to price b: positive when b is higher (the price drifted),
// negative when it shortened. Rounded to 2 decimals for off-ladder prices.
export function ticksBetween(a: number, b: number): number {
  return Math.round((tickIndex(b) - tickIndex(a)) * 100) / 100
}

export function tickSize(price: number): number {
  for (const [, hi, step] of BANDS) if (price < hi) return step
  return 10
}

// One tick above a price (where the lay price usually sits when only the last traded price is known).
export function tickUp(price: number): number {
  return Math.min(1000, Math.round((price + tickSize(price)) * 100) / 100)
}
