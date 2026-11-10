// ============================================================
// Football pricing maths used by the paper-test strategies.
//
// A match is modelled as two goal counts. From one "correct score grid"
// (probability of every scoreline) you can price match odds, over/under
// and correct score together. The Dixon-Coles adjustment (rho) fixes the
// plain Poisson model's habit of mispricing 0-0, 1-0, 0-1 and 1-1.
//
// Pure functions, no I/O. See lib/betfair/playbook.ts for the plain-English
// write-up and the Sports Hacker articles each piece comes from.
// ============================================================

export const GRID_N = 12 // goals 0..11 per side; the tail beyond is negligible

export function poissonVec(mean: number, n = GRID_N): number[] {
  let p = Math.exp(-mean)
  const out = [p]
  for (let i = 1; i < n; i++) { p *= mean / i; out.push(p) }
  return out
}

// grid[i][j] = P(home scores i, away scores j)
export function scoreGrid(lx: number, ly: number, rho = 0, n = GRID_N): number[][] {
  const hx = poissonVec(lx, n), ay = poissonVec(ly, n)
  const tau = (i: number, j: number) =>
    i === 0 && j === 0 ? 1 - lx * ly * rho
    : i === 0 && j === 1 ? 1 + lx * rho
    : i === 1 && j === 0 ? 1 + ly * rho
    : i === 1 && j === 1 ? 1 - rho
    : 1
  return hx.map((h, i) => ay.map((a, j) => Math.max(0, h * a * tau(i, j))))
}

function sumIf(g: number[][], keep: (i: number, j: number) => boolean): number {
  let s = 0
  for (let i = 0; i < g.length; i++) for (let j = 0; j < g.length; j++) if (keep(i, j)) s += g[i][j]
  return s
}
export const pHome = (g: number[][]) => sumIf(g, (i, j) => i > j)
export const pDraw = (g: number[][]) => sumIf(g, (i, j) => i === j)
export const pAway = (g: number[][]) => sumIf(g, (i, j) => i < j)
export const pOver = (g: number[][], line: number) => sumIf(g, (i, j) => i + j > line)
export const pUnder = (g: number[][], line: number) => sumIf(g, (i, j) => i + j < line)
export const pScore = (g: number[][], i: number, j: number) => (g[i]?.[j] ?? 0)

// ---------------------------------------------------------------- solver
// Small Nelder-Mead minimiser: enough for 2-3 parameters.
export function nelderMead(f: (x: number[]) => number, x0: number[], iters = 400, step = 0.25): { x: number[]; fx: number } {
  const n = x0.length
  let pts = [x0, ...x0.map((_, k) => x0.map((v, i) => (i === k ? v + step : v)))].map(x => ({ x, fx: f(x) }))
  for (let it = 0; it < iters; it++) {
    pts.sort((a, b) => a.fx - b.fx)
    if (Math.abs(pts[n].fx - pts[0].fx) < 1e-14) break
    const c = x0.map((_, i) => pts.slice(0, n).reduce((s, p) => s + p.x[i], 0) / n)
    const at = (t: number) => c.map((ci, i) => ci + t * (pts[n].x[i] - ci))
    const xr = at(-1), fr = f(xr)
    if (fr < pts[0].fx) {
      const xe = at(-2), fe = f(xe)
      pts[n] = fe < fr ? { x: xe, fx: fe } : { x: xr, fx: fr }
    } else if (fr < pts[n - 1].fx) {
      pts[n] = { x: xr, fx: fr }
    } else {
      const xc = at(fr < pts[n].fx ? -0.5 : 0.5), fc = f(xc)
      if (fc < Math.min(fr, pts[n].fx)) pts[n] = { x: xc, fx: fc }
      else pts = pts.map((p, k) => (k === 0 ? p : (() => { const x = p.x.map((v, i) => pts[0].x[i] + 0.5 * (v - pts[0].x[i])); return { x, fx: f(x) } })()))
    }
  }
  pts.sort((a, b) => a.fx - b.fx)
  return pts[0]
}

export type Target = { home: number; draw: number; away: number; over25?: number; under25?: number }
export type Fit = { lx: number; ly: number; rho: number; err: number }

// Find the goal expectations (and rho) whose grid reproduces the market's
// match odds and, when given, its over/under 2.5 prices. Probabilities in
// `t` must already have the bookmaker margin removed (sum to 1 per market).
// Without over/under prices rho can't be identified, so it is fixed at 0.
export function calibrate(t: Target): Fit {
  const withGoals = t.over25 !== undefined && t.under25 !== undefined
  const err = (q: number[]) => {
    const [lx, ly] = q
    const rho = withGoals ? q[2] : 0
    if (lx < 0.05 || ly < 0.05 || lx > 6 || ly > 6 || Math.abs(rho) > 0.3) return 1e3
    const g = scoreGrid(lx, ly, rho)
    let e = (pHome(g) - t.home) ** 2 + (pDraw(g) - t.draw) ** 2 + (pAway(g) - t.away) ** 2
    if (withGoals) e += (pOver(g, 2.5) - t.over25!) ** 2 + (pUnder(g, 2.5) - t.under25!) ** 2
    return e
  }
  const start = withGoals ? [1.4, 1.1, 0] : [1.4, 1.1]
  let best = nelderMead(err, start)
  best = nelderMead(err, best.x, 400, 0.05) // restart from the answer: cheap insurance against a stalled simplex
  return { lx: best.x[0], ly: best.x[1], rho: withGoals ? best.x[2] : 0, err: best.fx }
}
