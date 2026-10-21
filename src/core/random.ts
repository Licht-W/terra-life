/* Adapted from xoshiro128** 1.1 (2018, David Blackman and Sebastiano Vigna)
 * and SplitMix64 (2015, Sebastiano Vigna), https://prng.di.unimi.it/.
 * To the extent possible under law, the author has dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide.
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
 * IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

export type RandomState = readonly [number, number, number, number]
export type RandomStreams = Readonly<{
  life: RandomState
  flavor: RandomState
  birth: RandomState
}>
export type RandomResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

const UINT32_MAX = 0xffffffff
const UINT32_RANGE = 0x100000000
const UINT64_MASK = (1n << 64n) - 1n
const JUMP = [0x8764000b, 0xf542d2d3, 0x6fa035c3, 0x77f2db5b] as const

function isUint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
    && value >= 0 && value <= UINT32_MAX
}

/** Validate and copy without consuming any random output. Accepts JSON input. */
export function copyRandomState(input: unknown): RandomResult<RandomState> {
  if (!Array.isArray(input) || input.length !== 4) {
    return { ok: false, error: 'Random state must be an array of exactly four uint32 words.' }
  }
  for (let index = 0; index < 4; index += 1) {
    if (!isUint32(input[index])) {
      return { ok: false, error: `Random state word ${index} must be an integer in [0, 4294967295].` }
    }
  }
  if (input.every((word: number) => word === 0)) {
    return { ok: false, error: 'The all-zero random state is invalid.' }
  }
  return { ok: true, value: [input[0], input[1], input[2], input[3]] }
}

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0
}

// Internal inputs are already validated; every step returns a fresh array.
function step(state: RandomState): { output: number; state: RandomState } {
  let [s0, s1, s2, s3] = state
  const output = Math.imul(rotateLeft(Math.imul(s1, 5), 7), 9) >>> 0
  const shifted = s1 << 9
  s2 ^= s0
  s3 ^= s1
  s1 ^= s2
  s0 ^= s3
  s2 ^= shifted
  s3 = rotateLeft(s3, 11)
  return { output, state: [s0 >>> 0, s1 >>> 0, s2 >>> 0, s3] }
}

export function nextUint32(input: unknown): RandomResult<{ output: number; state: RandomState }> {
  const checked = copyRandomState(input)
  return checked.ok ? { ok: true, value: step(checked.value) } : checked
}

function jumpState(initial: RandomState): RandomState {
  let state = initial
  const accumulated = [0, 0, 0, 0]
  for (const polynomial of JUMP) {
    for (let bit = 0; bit < 32; bit += 1) {
      if ((polynomial & (1 << bit)) !== 0) {
        for (let word = 0; word < 4; word += 1) accumulated[word] ^= state[word]
      }
      state = step(state).state
    }
  }
  return [accumulated[0] >>> 0, accumulated[1] >>> 0,
    accumulated[2] >>> 0, accumulated[3] >>> 0]
}

/** Author's jump: 2^64 state transitions. Does not mutate the caller's state. */
export function jumpRandomState(input: unknown): RandomResult<RandomState> {
  const checked = copyRandomState(input)
  return checked.ok ? { ok: true, value: jumpState(checked.value) } : checked
}

export function createRandomStreams(seed: unknown): RandomResult<RandomStreams> {
  if (typeof seed !== 'string' || seed.length !== 16 || !/^[0-9a-f]{16}$/.test(seed)) {
    return { ok: false, error: 'Seed must be exactly 16 lowercase hexadecimal characters.' }
  }
  let splitmixState = BigInt(`0x${seed}`)
  function splitmix64(): bigint {
    splitmixState = (splitmixState + 0x9e3779b97f4a7c15n) & UINT64_MASK
    let mixed = splitmixState
    mixed = ((mixed ^ (mixed >> 30n)) * 0xbf58476d1ce4e5b9n) & UINT64_MASK
    mixed = ((mixed ^ (mixed >> 27n)) * 0x94d049bb133111ebn) & UINT64_MASK
    return mixed ^ (mixed >> 31n)
  }
  const first = splitmix64()
  const second = splitmix64()
  const initial = copyRandomState([
    Number(first & 0xffffffffn), Number(first >> 32n),
    Number(second & 0xffffffffn), Number(second >> 32n),
  ])
  if (!initial.ok) return initial
  const life = initial.value
  const flavor = jumpState(life)
  const birth = jumpState(flavor)
  return { ok: true, value: { life, flavor, birth } }
}

/** Conversion only: no generator state and no additional random consumption. */
export function uint32ToUnit(input: unknown): RandomResult<number> {
  return isUint32(input)
    ? { ok: true, value: input / UINT32_RANGE }
    : { ok: false, error: 'Conversion input must be an integer in [0, 4294967295].' }
}
