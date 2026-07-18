/* ── Seeded PRNG สำหรับเกมเศรษฐี ──────────────────────────────────────
   เกมต้อง deterministic จาก seed เดียว (ใช้ replay ทำ counterfactual insight)
   ห้ามใช้ Math.random ใน engine เด็ดขาด */

export type Rng = () => number

/** mulberry32 — PRNG เบาๆ คุณภาพพอสำหรับเกม คืนค่า [0,1) */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

/** สุ่มแจกแจงปกติ (Box–Muller) mean 0, sd 1 */
export function randNorm(rng: Rng): number {
  let u = 0, v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** seed ใหม่แบบสุ่มจริง (ใช้ตอนกดเริ่มเกมเท่านั้น — นอก engine) */
export const newSeed = () => Math.floor(Math.random() * 0xffffffff)
