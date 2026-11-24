/** Mulberry32, with an explicit state for exact checkpoint resumption. */
export function createSleepRandom(seed: number, xorConstant = 61) {
  let state = seed >>> 0
  return {
    get state() { return state },
    next() {
      state = (state + 0x6D2B79F5) >>> 0
      let x = state
      x = Math.imul(x ^ (x >>> 15), x | 1)
      x ^= x + Math.imul(x ^ (x >>> 7), x | xorConstant)
      return ((x ^ (x >>> 14)) >>> 0) / 0x100000000
    },
  }
}
