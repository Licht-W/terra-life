import { describe, expect, it } from 'vitest'
import { BIRTH_FIXTURE } from '../src/content/birth-fixture'
import { BIRTH_FAMILIES, BIRTH_RANDOM_CONTRACT, BIRTH_RULES_VERSION,
  copyBirthDraft, createBirthDraft, rerollBirth, startBirth } from '../src/core/birth'
import type { BirthConfig, BirthDraft, BirthFamily, BirthResult, WeightedCandidate } from '../src/core/birth'
import { createRandomStreams, nextUint32 } from '../src/core/random'
import type { RandomState } from '../src/core/random'
import vectors from './reference/random-vectors.json'

const SEED = '0123456789abcdef'
type Mutable<T> = { -readonly [P in keyof T]: Mutable<T[P]> }
function config(): Mutable<BirthConfig> { return structuredClone(BIRTH_FIXTURE) as Mutable<BirthConfig> }
function value<T>(result: BirthResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
function randomValue<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error)
  return result.value
}
function freeze<T>(input: T): T {
  if (typeof input === 'object' && input !== null) {
    for (const child of Object.values(input)) freeze(child)
    Object.freeze(input)
  }
  return input
}
function singleton(amount: number): WeightedCandidate<number>[] {
  return [{ id: 'only', value: amount, weight: 1 }]
}
function fixedFamily(key: BirthFamily): Mutable<BirthConfig> {
  const data = config()
  for (const entry of data.families) entry.weight = entry.value === key ? 1 : 0
  return data
}
function fixedConfig(key: BirthFamily = 'modest'): Mutable<BirthConfig> {
  const data = fixedFamily(key)
  data.basic = { health: singleton(70), spirit: singleton(60),
    knowledge: singleton(5), connections: singleton(10) }
  for (const { key: familyKey } of BIRTH_FAMILIES) data.funds[familyKey] = singleton(30)
  return data
}
function atState(data: BirthConfig, birth: RandomState): BirthDraft {
  return { ...value(createBirthDraft(SEED, data)), random: {
    ...randomValue(createRandomStreams(SEED)), birth } }
}
function advance(state: RandomState, times: number) {
  const outputs: number[] = []
  for (let i = 0; i < times; i += 1) {
    const next = randomValue(nextUint32(state))
    outputs.push(next.output)
    state = next.state
  }
  return { state, outputs }
}
function fails(result: BirthResult<unknown>, kind?: string) {
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('Expected rejection')
  expect(result.error.message.length).toBeGreaterThan(0)
  if (kind) expect(result.error.kind).toBe(kind)
  expect(result).not.toHaveProperty('value')
}

describe('adopted family definitions and independent basic tables (AC1, AC2)', () => {
  it('keeps the five adopted names and meanings, with stable keys', () => {
    expect(BIRTH_FAMILIES).toEqual([
      { key: 'dayToDay', name: '日々をしのぐ暮らし', meaning: '食料・住居・医療の確保にも苦労する、生活基盤が非常に弱い家庭' },
      { key: 'frugal', name: '切り詰めた暮らし', meaning: '基本的な生活は維持しているが、経済的な余裕がほとんどない家庭' },
      { key: 'modest', name: 'つつましい暮らし', meaning: '日常生活はおおむね安定しているが、大きな支出には工夫が必要な家庭' },
      { key: 'comfortable', name: 'ゆとりのある暮らし', meaning: '安定した経済基盤があり、教育・治療などにも比較的余裕がある家庭' },
      { key: 'wealthy', name: '裕福な暮らし', meaning: '十分な蓄えや経済基盤を持ち、高額な支出や継続的な支援も可能な家庭' },
    ])
  })

  // Controlled quantiles plus C-vector states target each positive funds interval.
  const quantiles: RandomState[] = [[1, 0, 3, 4], [1, 3439329280, 3, 4], [1, 2199679431, 3, 4]]
  const amounts = [[0, 10, 30], [0, 10, 30], [10, 30, 60], [30, 60, 120], [30, 120, 200]]
  it.each(BIRTH_FAMILIES.map((entry, index) => ({ ...entry, index })))('selects and fixes every funds branch for $key', ({ key, index }) => {
    const seen: number[] = []
    for (let q = 0; q < quantiles.length; q += 1) {
      const data = fixedConfig(key)
      data.funds[key] = structuredClone(BIRTH_FIXTURE.funds[key]) as Mutable<WeightedCandidate<number>[]>
      const steps = vectors.seeds.find(({ seed }) => seed === SEED)!.streams.birth.steps
      // dayToDay middle interval [4/7,6/7): next C output 3090706140 / 2^32.
      // wealthy middle interval [1/7,3/7): next C output 1197164359 / 2^32.
      const birth = q === 1 && key === 'dayToDay' ? steps[2].state as unknown as RandomState
        : q === 1 && key === 'wealthy' ? steps[4].state as unknown as RandomState : quantiles[q]
      const rolled = value(rerollBirth(atState(data, birth), data))
      expect(rolled.candidate).toEqual({ country: 'ヴィクトリア', species: 'フェリーン', family: key,
        values: { health: 70, spirit: 60, funds: amounts[index][q], knowledge: 5, connections: 10 } })
      const started = value(startBirth(rolled))
      expect(started.origin.birthFamily).toBe(key)
      expect(started.origin.initialValues.funds).toBe(amounts[index][q])
      seen.push(rolled.candidate.values.funds)
    }
    expect(new Set(seen).size).toBeGreaterThan(1)
  })

  it('uses identical shared ability distributions and draw counts for every family', () => {
    const cases = BIRTH_FAMILIES.map(({ key }) => value(createBirthDraft(SEED, fixedFamily(key))))
    const expected = { health: 100, spirit: 60, knowledge: 5, connections: 10 }
    for (const draft of cases) {
      const { funds: _funds, ...basic } = draft.candidate.values
      expect(basic).toEqual(expected)
      expect(draft.random.birth).toEqual(cases[0].random.birth)
    }
  })
})

describe('weighted boundaries, zero weights and exact consumption (AC8)', () => {
  // Inverse of out = rotl(s[1]*5,7)*9 modulo 2^32, calculated independently.
  it.each([
    { output: 0, s1: 0, expected: 10 },
    { output: 2147483647, s1: 3055317447, expected: 10 },
    { output: 2147483648, s1: 3439329280, expected: 20 },
    { output: 2147483649, s1: 387367276, expected: 20 },
    { output: 4294967295, s1: 2199679431, expected: 20 },
  ])('selects the half-open funds interval at output $output', ({ output, s1, expected }) => {
    const data = fixedConfig()
    data.funds.modest = [{ id: 'zero-first', value: 999, weight: 0 },
      { id: 'first', value: 10, weight: 1 }, { id: 'zero-middle', value: 999, weight: 0 },
      { id: 'second', value: 20, weight: 1 }, { id: 'zero-last', value: 999, weight: 0 }]
    const state: RandomState = [1, s1, 3, 4]
    expect(randomValue(nextUint32(state)).output).toBe(output)
    const rolled = value(rerollBirth(atState(data, state), data))
    expect(rolled.candidate.values.funds).toBe(expected)
    expect(rolled.random.birth).toEqual(advance(state, 1).state)
  })

  it('does not draw for single effective entries, including surrounded zero weights', () => {
    const data = fixedConfig()
    data.basic.health = [{ id: 'zero', value: 0, weight: 0 }, ...singleton(70)]
    const initial = randomValue(createRandomStreams(SEED))
    const draft = value(createBirthDraft(SEED, data))
    expect(draft.random).toEqual(initial)
    const rolled = value(rerollBirth(draft, data))
    expect(rolled.random).toEqual(initial)
    expect(rolled.rerollCount).toBe(1)
  })

  it('respects data array order, including fractional and subnormal positive weights', () => {
    const data = fixedConfig()
    data.funds.modest = [{ id: 'a', value: 10, weight: 0.5 }, { id: 'b', value: 20, weight: 0.5 }]
    const state: RandomState = [1, 0, 3, 4]
    expect(value(rerollBirth(atState(data, state), data)).candidate.values.funds).toBe(10)
    data.funds.modest.reverse()
    expect(value(rerollBirth(atState(data, state), data)).candidate.values.funds).toBe(20)
    for (const entry of data.funds.modest) entry.weight = Number.MIN_VALUE
    const last: RandomState = [1, 2199679431, 3, 4]
    expect(value(rerollBirth(atState(data, last), data)).candidate.values.funds).toBe(10)
  })

  it('selects every family interval in the real multiple-candidate fixture', () => {
    // Weights [1,2,4,2,1] / 10; output 0 and C outputs at 0.278,0.622,0.809,0.945.
    const steps = vectors.seeds.find(({ seed }) => seed === SEED)!.streams.birth.steps
    const positions = [8, 5, 2, 6, 10]
    const draft = value(createBirthDraft(SEED, BIRTH_FIXTURE))
    for (let i = 0; i < positions.length; i += 1) {
      // First interval needs output 0: no C seed output is required for that boundary.
      const state = i === 0 ? [1, 0, 3, 4] as const : steps[positions[i] - 1].state as unknown as RandomState
      const result = value(rerollBirth({ ...draft, random: { ...draft.random, birth: state } }, BIRTH_FIXTURE))
      expect(result.candidate.family).toBe(BIRTH_FAMILIES[i].key)
    }
  })
})

describe('fixed replay, start and noninterference (AC3–AC6)', () => {
  it('matches hand-evaluated cumulative weights against the existing independent C vectors', () => {
    const fixture = vectors.seeds.find(({ seed }) => seed === SEED)!.streams.birth
    const first = value(createBirthDraft(SEED, BIRTH_FIXTURE))
    expect(first.candidate).toEqual({ country: 'ヴィクトリア', species: 'フェリーン', family: 'comfortable',
      values: { health: 70, spirit: 60, funds: 60, knowledge: 10, connections: 0 } })
    expect(first.rerollCount).toBe(0)
    expect(first.random.birth).toEqual(fixture.steps[5].state)
    const second = value(rerollBirth(first, BIRTH_FIXTURE))
    expect(second.candidate.values).toEqual({ health: 100, spirit: 30, funds: 60, knowledge: 10, connections: 10 })
    expect(second.candidate.family).toBe('comfortable')
    expect(second.rerollCount).toBe(1)
    expect(second.random.birth).toEqual(fixture.steps[11].state)
  })

  it.each(vectors.seeds)('replays 4 rerolls, isolates other streams and resumes from JSON: $seed', ({ seed }) => {
    const data = freeze(config())
    let draft = value(createBirthDraft(seed, data))
    const original = randomValue(createRandomStreams(seed))
    const first = value(startBirth(draft))
    expect(first.origin.rerollCount).toBe(0)
    expect(first.origin.initialValues).toEqual(draft.candidate.values)
    expect(first.random).toEqual(draft.random)
    let copy = value(copyBirthDraft(freeze(structuredClone(draft))))
    let json: unknown = JSON.parse(JSON.stringify(draft))
    const sequence = [draft]
    for (let index = 1; index <= 4; index += 1) {
      const before = structuredClone(draft)
      freeze(draft)
      draft = value(rerollBirth(draft, data))
      expect(sequence[index - 1]).toEqual(before)
      copy = value(rerollBirth(copy, data))
      json = value(rerollBirth(json, data))
      expect(copy).toEqual(draft)
      expect(json).toEqual(draft)
      expect(draft.rerollCount).toBe(index)
      expect(draft.random.birth).toEqual(advance(original.birth, 6 * (index + 1)).state)
      for (const key of ['life', 'flavor'] as const) {
        expect(draft.random[key]).toEqual(original[key])
        expect(advance(draft.random[key], 12)).toEqual(advance(original[key], 12))
      }
      sequence.push(draft)
    }
    let replay = value(createBirthDraft(seed, data))
    expect(replay).toEqual(sequence[0])
    for (const expected of sequence.slice(1)) {
      replay = value(rerollBirth(replay, data))
      expect(replay).toEqual(expected)
    }
    const started = value(startBirth(freeze(draft)))
    expect(started).toEqual(value(startBirth(copy)))
    expect(started).toEqual(value(startBirth(json)))
    // Same pre-start input may be evaluated twice; operations on started state reject.
    expect(started).toEqual(value(startBirth(draft)))
    expect(started.seasonIndex).toBe(0)
    expect(started.origin).toEqual({ seed, rerollCount: 4, country: 'ヴィクトリア', species: 'フェリーン',
      birthFamily: draft.candidate.family, initialValues: draft.candidate.values,
      versions: { rules: BIRTH_RULES_VERSION, random: BIRTH_RANDOM_CONTRACT,
        data: data.dataVersion, tuning: data.tuningVersion }, startRandom: draft.random })
    expect(started.random).toEqual(draft.random)
    const before = structuredClone(started)
    freeze(started)
    fails(rerollBirth(started, data), 'rejected')
    fails(startBirth(started), 'rejected')
    expect(started).toEqual(before)
  })

  it('copies results without aliases to input, config, origin or current person values', () => {
    const data = config()
    const first = value(createBirthDraft(SEED, data))
    const baseline = structuredClone(first)
    const copy = value(copyBirthDraft(first)) as Mutable<BirthDraft>
    const rolled = value(rerollBirth(first, data)) as Mutable<BirthDraft>
    copy.candidate.values.funds = 999
    copy.random.birth[0] = 0
    copy.versions.data = 'changed'
    rolled.random.life[0] = 0
    rolled.random.flavor[0] = 0
    expect(first).toEqual(baseline)
    const started = value(startBirth(first))
    const startBaseline = structuredClone(started)
    data.funds.comfortable[1].value = 999
    const mutableFirst = first as Mutable<BirthDraft>
    mutableFirst.candidate.values.funds = 888
    mutableFirst.random.life[0] = 0
    mutableFirst.versions.data = 'changed'
    expect(started).toEqual(startBaseline)
    const mutableStart = started as Mutable<typeof started>
    mutableStart.person.funds = 777
    mutableStart.random.birth[0] = 0
    expect(started.origin).toEqual(startBaseline.origin)
    mutableStart.origin.initialValues.health = 0
    mutableStart.origin.startRandom.life[0] = 0
    expect(started.person.health).toBe(startBaseline.person.health)
    expect(started.random.life).toEqual(startBaseline.random.life)
  })

  it('accepts zero health, all other zeros and exact funds above the fixture maximum', () => {
    const data = fixedConfig()
    for (const key of ['health', 'spirit', 'knowledge', 'connections'] as const) data.basic[key] = singleton(0)
    for (const funds of [0, 201, Number.MAX_SAFE_INTEGER]) {
      data.funds.modest = singleton(funds)
      const started = value(startBirth(value(createBirthDraft(SEED, data))))
      expect(started.person).toEqual({ health: 0, spirit: 0, funds, knowledge: 0, connections: 0 })
      expect(started).not.toHaveProperty('alive')
      expect(started).not.toHaveProperty('debt')
    }
    data.basic.health = singleton(0.5)
    expect(value(createBirthDraft(SEED, data)).candidate.values.health).toBe(0.5)
  })
})

describe('invalid inputs and atomic failure (AC7)', () => {
  const badConfigs: { name: string; change: (input: Mutable<BirthConfig>) => void }[] = [
    { name: 'missing data version', change: (d) => { d.dataVersion = '' } },
    { name: 'missing tuning version', change: (d) => { d.tuningVersion = '' } },
    { name: 'empty family table', change: (d) => { d.families = [] } },
    { name: 'duplicate family ID', change: (d) => { d.families[1].id = d.families[0].id } },
    { name: 'duplicate family category', change: (d) => { d.families[1].value = d.families[0].value } },
    { name: 'unknown family', change: (d) => { (d.families[0] as { value: string }).value = 'unknown' } },
    { name: 'missing family', change: (d) => { d.families.pop() } },
    { name: 'no positive family', change: (d) => { d.families.forEach((entry) => { entry.weight = 0 }) } },
    { name: 'missing basic table', change: (d) => { Reflect.deleteProperty(d.basic, 'health') } },
    { name: 'unknown basic table', change: (d) => { Object.assign(d.basic, { familyHealth: [] }) } },
    { name: 'missing unselected family funds', change: (d) => { Reflect.deleteProperty(d.funds, 'dayToDay') } },
    { name: 'unknown funds family', change: (d) => { Object.assign(d.funds, { unknown: singleton(1) }) } },
    { name: 'empty late table', change: (d) => { d.basic.connections = [] } },
    { name: 'duplicate late ID', change: (d) => { d.basic.connections[1].id = d.basic.connections[0].id } },
    { name: 'blank candidate ID', change: (d) => { d.basic.connections[0].id = ' ' } },
    ...[-1, NaN, Infinity, -Infinity, '1', null].map((weight) => ({ name: `invalid weight ${weight}`,
      change: (d: Mutable<BirthConfig>) => { Object.assign(d.basic.connections[0], { weight }) } })),
    { name: 'zero total', change: (d) => { d.basic.connections.forEach((entry) => { entry.weight = 0 }) } },
    { name: 'nonfinite total', change: (d) => { d.basic.connections.forEach((entry) => { entry.weight = Number.MAX_VALUE }) } },
    { name: 'lost positive weight precision', change: (d) => {
      d.basic.connections[0].weight = 1e100; d.basic.connections[1].weight = 1
    } },
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '1', null].map((amount) => ({ name: `invalid funds ${amount}`,
      change: (d: Mutable<BirthConfig>) => { Object.assign(d.funds.dayToDay[0], { value: amount }) } })),
    ...[-1, 100.1, NaN, Infinity, '1', null].map((amount) => ({ name: `invalid basic ${amount}`,
      change: (d: Mutable<BirthConfig>) => { Object.assign(d.basic.connections[0], { value: amount }) } })),
  ]
  it.each(badConfigs)('rejects $name before generation or reroll, preserving the full input', ({ change }) => {
    const draft = freeze(value(createBirthDraft(SEED, BIRTH_FIXTURE)))
    const before = structuredClone(draft)
    const data = config()
    change(data)
    const dataBefore = structuredClone(data)
    freeze(data)
    fails(createBirthDraft(SEED, data), 'invalid-config')
    fails(rerollBirth(draft, data), 'invalid-config')
    expect(data).toEqual(dataBefore)
    expect(draft).toEqual(before)
    // No candidate, count or consumed RNG from a failed unit leaks into continuation.
    expect(value(rerollBirth(draft, BIRTH_FIXTURE))).toEqual(value(rerollBirth(before, BIRTH_FIXTURE)))
  })

  it.each([undefined, null, [], {}, { basic: {}, funds: {} }])('rejects absent config %s without fabricating state', (data) => {
    fails(createBirthDraft(SEED, data), 'invalid-config')
    const draft = value(createBirthDraft(SEED, BIRTH_FIXTURE))
    fails(rerollBirth(draft, data), 'invalid-config')
  })
  it.each([undefined, null, 0, '', '0', '0123456789ABCDEF', '0000000000000000\n', 'gggggggggggggggg'])('rejects seed %s', (seed) => {
    fails(createBirthDraft(seed, BIRTH_FIXTURE), 'invalid-seed')
  })

  const badStates: { name: string; change: (draft: Mutable<BirthDraft>) => void }[] = [
    { name: 'unknown phase', change: (d) => { Object.assign(d, { phase: 'other' }) } },
    { name: 'invalid seed', change: (d) => { d.seed = '0' } },
    { name: 'uppercase seed', change: (d) => { d.seed = SEED.toUpperCase() } },
    ...[-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '1'].map((count) => ({ name: `invalid count ${count}`,
      change: (d: Mutable<BirthDraft>) => { Object.assign(d, { rerollCount: count }) } })),
    { name: 'missing versions', change: (d) => { Reflect.deleteProperty(d, 'versions') } },
    { name: 'unsupported rules', change: (d) => { Object.assign(d.versions, { rules: 'other' }) } },
    { name: 'unsupported random contract', change: (d) => { Object.assign(d.versions, { random: 'other' }) } },
    { name: 'blank data', change: (d) => { d.versions.data = '' } },
    { name: 'blank tuning', change: (d) => { d.versions.tuning = '' } },
    { name: 'missing candidate', change: (d) => { Reflect.deleteProperty(d, 'candidate') } },
    { name: 'wrong country', change: (d) => { Object.assign(d.candidate, { country: 'other' }) } },
    { name: 'wrong species', change: (d) => { Object.assign(d.candidate, { species: 'other' }) } },
    { name: 'unknown family', change: (d) => { Object.assign(d.candidate, { family: 'other' }) } },
    { name: 'missing values', change: (d) => { Reflect.deleteProperty(d.candidate, 'values') } },
    { name: 'invalid health', change: (d) => { d.candidate.values.health = -1 } },
    { name: 'invalid spirit', change: (d) => { d.candidate.values.spirit = Infinity } },
    { name: 'invalid knowledge', change: (d) => { d.candidate.values.knowledge = 101 } },
    { name: 'invalid connections', change: (d) => { d.candidate.values.connections = NaN } },
    { name: 'invalid funds', change: (d) => { d.candidate.values.funds = 0.1 } },
    { name: 'missing random', change: (d) => { Reflect.deleteProperty(d, 'random') } },
    ...(['life', 'flavor', 'birth'] as const).flatMap((stream) => [
      { name: `missing ${stream}`, change: (d: Mutable<BirthDraft>) => { Reflect.deleteProperty(d.random, stream) } },
      ...[[0, 0, 0, 0], [1, 2, 3], [1, 2, 3, -1], [1, 2, 3, 0x100000000], [1, 2, 3, 0.5], [1, NaN, 3, 4]].map((state) => ({
        name: `invalid ${stream} ${state}`, change: (d: Mutable<BirthDraft>) => { Object.assign(d.random, { [stream]: state }) },
      })),
    ]),
  ]
  it.each(badStates)('rejects $name on copy/reroll/start without mutation', ({ change }) => {
    const draft = value(createBirthDraft(SEED, BIRTH_FIXTURE)) as Mutable<BirthDraft>
    change(draft)
    const before = structuredClone(draft)
    freeze(draft)
    fails(copyBirthDraft(draft), 'invalid-state')
    fails(rerollBirth(draft, BIRTH_FIXTURE), 'invalid-state')
    fails(startBirth(draft), 'invalid-state')
    expect(draft).toEqual(before)
  })

  it.each([undefined, null, [], {}, { phase: 'other' }])('rejects missing/unknown stage %s', (input) => {
    fails(rerollBirth(input, BIRTH_FIXTURE), 'invalid-state')
    fails(startBirth(input), 'invalid-state')
  })
  it('rejects a version change and count overflow without changing candidate or random', () => {
    const draft = freeze(value(createBirthDraft(SEED, BIRTH_FIXTURE)))
    for (const key of ['dataVersion', 'tuningVersion'] as const) {
      const data = config()
      data[key] += '-new'
      fails(rerollBirth(draft, data), 'invalid-config')
    }
    const max = freeze({ ...draft, rerollCount: Number.MAX_SAFE_INTEGER })
    const before = structuredClone(max)
    fails(rerollBirth(max, BIRTH_FIXTURE), 'invalid-state')
    expect(max).toEqual(before)
    expect(value(startBirth(max)).origin.rerollCount).toBe(Number.MAX_SAFE_INTEGER)
  })
})
