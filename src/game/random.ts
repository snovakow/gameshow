// A source of numbers in [0, 1): the app passes Math.random, and the tests a seeded generator, so
// a test replays the same draws every run
export type Random = () => number

// mulberry32: a 32-bit state, quick and evenly spread, which is all dealing crates and simulating
// shows needs; not for anything that must be unpredictable
export function mulberry32(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
