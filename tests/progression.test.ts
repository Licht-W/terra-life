import { describe, expect, it } from 'vitest'
import { BIRTH_FIXTURE } from '../src/content/birth-fixture'
import { createBirthDraft, startBirth } from '../src/core/birth'
import type { BirthConfig, StartedBirth } from '../src/core/birth'
import { advanceCore, connectBirth, copyCoreState, SEASONS } from '../src/core/progression'
import type { AdvanceInput, CoreResult, CoreState, NormalState, RunningState } from '../src/core/progression'

type Mutable<T> = { -readonly [P in keyof T]: Mutable<T[P]> }
const SEED = '0123456789abcdef'
function birth(health = 70, spirit = 60, funds = 30): StartedBirth {
  const config = structuredClone(BIRTH_FIXTURE) as Mutable<BirthConfig>
  config.basic.health = [{ id: 'fixed-health', value: health, weight: 1 }]
  config.basic.spirit = [{ id: 'fixed-spirit', value: spirit, weight: 1 }]
  for (const key of Object.keys(config.funds) as (keyof BirthConfig['funds'])[]) {
    config.funds[key] = [{ id: 'fixed-funds', value: funds, weight: 1 }]
  }
  const draft = createBirthDraft(SEED, config)
  if (!draft.ok) throw new Error(draft.error.message)
  const started = startBirth(draft.value)
  if (!started.ok) throw new Error(started.error.message)
  return started.value
}
function accepted(result: CoreResult): NormalState {
  expect(result.kind).toBe('accepted')
  if (result.kind !== 'accepted') throw new Error('Expected accepted state')
  return result.state
}
function initial(health = 70, spirit = 60, funds = 30): RunningState {
  return accepted(connectBirth(birth(health, spirit, funds), 'fixture-life-A')) as RunningState
}
function input(state: NormalState) {
  return { kind: 'advance', lifeId: state.lifeId, expectedRevision: state.revision } as const
}
function step(state: NormalState) { return accepted(advanceCore(state, input(state))) }
function run(state: NormalState, count: number) {
  for (let i = 0; i < count; i += 1) state = step(state)
  return state
}
function json<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
function checked(state: unknown): CoreState {
  const result = copyCoreState(state)
  if (!result.ok) throw new Error(result.reason)
  return result.value
}

describe('birth connection and value ownership (AC1)', () => {
  it('connects a frozen started birth without draws and owns all nested values', () => {
    const source = freeze(birth())
    const before = json(source)
    const state = accepted(connectBirth(source, 'caller-life'))
    expect(state).toMatchObject({ status: 'running', lifeId: 'caller-life', revision: 0,
      seasonIndex: 0, stage: 'check-health', history: [] })
    expect(state.person).toEqual(source.person)
    expect(state.origin).toEqual(source.origin)
    expect(state.random).toEqual(source.random)
    const mutable = state as Mutable<NormalState>
    mutable.person.health = 1
    mutable.origin.initialValues.funds = 999
    mutable.origin.versions.data = 'changed'
    mutable.random.life[0] ^= 1
    mutable.origin.startRandom.birth[0] ^= 1
    expect(source).toEqual(before)
    expect(state.origin.initialValues.health).toBe(70)
    expect(state.person.funds).toBe(30)
    expect(state.random.birth).toEqual(source.random.birth)
    expect(state.origin.startRandom.life).toEqual(source.random.life)
  })
  it('rejects a birth draft and accepts JSON of the started birth', () => {
    const draft = createBirthDraft(SEED, BIRTH_FIXTURE)
    expect(draft.ok).toBe(true)
    if (!draft.ok) return
    expect(connectBirth(draft.value, 'A').kind).toBe('rejected')
    const source = birth()
    expect(connectBirth(json(source), 'A')).toEqual(connectBirth(source, 'A'))
  })
  it.each(['', ' ', null, 1])('rejects invalid caller lifeId %s', (id) => {
    expect(connectBirth(birth(), id).kind).toBe('rejected')
  })
  it.each(['phase', 'season', 'person', 'random', 'origin'] as const)('detects an inconsistent started %s', (field) => {
    const source = json(birth()) as Mutable<StartedBirth>
    const raw = source as unknown as Record<string, unknown>
    if (field === 'phase') raw.phase = 'unknown'
    if (field === 'season') raw.seasonIndex = 1
    if (field === 'person') source.person.health = 2
    if (field === 'random') source.random.life[0] ^= 1
    if (field === 'origin') source.origin.versions.rules = 'unsupported' as never
    expect(connectBirth(source, 'A').kind).toBe('invalid-state')
  })
})

describe('season position and resumption (AC2, AC4, AC7)', () => {
  it('advances spring, summer, autumn, winter, then age-one spring only on completion', () => {
    let state: NormalState = freeze(initial())
    const random = json(state.random)
    for (let index = 0; index < 5; index += 1) {
      expect(state.seasonIndex).toBe(index)
      expect(SEASONS[state.seasonIndex % 4]).toBe(['spring', 'summer', 'autumn', 'winter', 'spring'][index])
      expect(Math.floor(state.seasonIndex / 4)).toBe(index === 4 ? 1 : 0)
      const midway = step(freeze(state))
      expect(midway.stage).toBe('complete-season')
      expect(midway.seasonIndex).toBe(index)
      expect(midway.revision).toBe(state.revision + 1)
      state = step(freeze(midway))
      expect(state.stage).toBe('check-health')
      expect(state.revision).toBe(2 * (index + 1))
      expect(state.random).toEqual(random)
      expect(state.history).toEqual([])
    }
  })
  it.each(Array.from({ length: 16 }, (_, position) => position))('resumes at reachable step %i with the same remaining input sequence', (position) => {
    let state: NormalState = initial()
    const inputs = []
    const states: NormalState[] = [state]
    for (let i = 0; i < 20; i += 1) {
      inputs.push(input(state))
      state = step(state)
      states.push(state)
    }
    let resumed = checked(json(states[position])) as NormalState
    for (const command of inputs.slice(position)) resumed = accepted(advanceCore(freeze(resumed), freeze(command)))
    expect(resumed).toEqual(state)
    expect(resumed).toMatchObject({ seasonIndex: 10, revision: 20, stage: 'check-health', history: [] })
    expect(resumed.random).toEqual(initial().random)
  })
  it('copies every nested value on progression and the JSON validation boundary', () => {
    const source = freeze(initial())
    const next = step(source)
    const copied = checked(next) as Mutable<RunningState>
    copied.person.funds = 99
    copied.origin.initialValues.health = 1
    copied.origin.startRandom.life[0] ^= 1
    copied.random.flavor[0] ^= 1
    expect(next.person.funds).toBe(30)
    expect(next.origin.initialValues.health).toBe(70)
    expect(next.random).toEqual(source.random)
    expect(next.origin).toEqual(source.origin)
  })
})

describe('input refusal and immutable identity (AC3)', () => {
  it.each([
    null, {}, { kind: 'choose', lifeId: 'fixture-life-A', expectedRevision: 0 },
    { kind: 'advance', lifeId: 'fixture-life-B', expectedRevision: 0 },
    { kind: 'advance', lifeId: 'fixture-life-A', expectedRevision: 1 },
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map((expectedRevision) =>
      ({ kind: 'advance', lifeId: 'fixture-life-A', expectedRevision })),
  ])('does not change any state for invalid/stale input %#', (command) => {
    const state = freeze(initial())
    const before = json(state)
    const result = advanceCore(state, command)
    expect(result.kind).toBe('rejected')
    expect(result).not.toHaveProperty('state')
    expect(state).toEqual(before)
  })
  it('refuses successful input replay at both stages and on another life', () => {
    let state: NormalState = initial()
    for (let i = 0; i < 8; i += 1) {
      const command: AdvanceInput = freeze(input(state))
      state = freeze(accepted(advanceCore(state, command)))
      const before = json(state)
      expect(advanceCore(state, command).kind).toBe('rejected')
      expect(state).toEqual(before)
    }
    expect(advanceCore(accepted(connectBirth(birth(), 'other')), input(initial())).kind).toBe('rejected')
  })
})

describe('health-zero death is a normal, single terminal result (AC5)', () => {
  it('preserves zero at connection, then dies at age-zero spring without progressing', () => {
    const state = initial(0)
    expect(state.person.health).toBe(0)
    expect(state.history).toEqual([])
    const dead = step(freeze(state))
    expect(dead).toMatchObject({ status: 'dead', revision: 1, seasonIndex: 0,
      history: [{ kind: 'death', cause: 'health-zero', seasonIndex: 0, age: 0, season: 'spring' }] })
    expect(dead.random).toEqual(state.random)
    expect(checked(json(dead))).toEqual(dead)
    for (let i = 0; i < 3; i += 1) {
      expect(advanceCore(freeze(dead), input(dead)).kind).toBe('rejected')
      expect(advanceCore(dead, input(state)).kind).toBe('rejected')
    }
    expect(dead.history).toHaveLength(1)
    expect(dead.seasonIndex).toBe(0)
  })
  // External structurally valid snapshots exercise death at later seasons, without a mutation API.
  it.each([0, 1, 2, 3, 4, 7].flatMap((seasonIndex) =>
    (['check-health', 'complete-season'] as const).map((stage) => ({ seasonIndex, stage }))))('keeps death at index $seasonIndex / $stage', ({ seasonIndex, stage }) => {
    const state = { ...initial(0), seasonIndex, stage, revision: 2 * seasonIndex + (stage === 'complete-season' ? 1 : 0) }
    const dead = step(freeze(state))
    expect(dead.status).toBe('dead')
    expect(dead.seasonIndex).toBe(seasonIndex)
    expect(dead.history).toEqual([{ kind: 'death', cause: 'health-zero', seasonIndex,
      age: Math.floor(seasonIndex / 4), season: SEASONS[seasonIndex % 4] }])
    expect(dead.random).toEqual(state.random)
    expect(checked(json(dead))).toEqual(dead)
  })
  it.each([0.5, 1, 100])('does not kill positive health %s for zero spirit and funds', (health) => {
    const state = initial(health, 0, 0)
    const next = run(freeze(state), 16)
    expect(next).toMatchObject({ status: 'running', seasonIndex: 8, history: [], person: { health, spirit: 0, funds: 0 } })
    expect(next.random).toEqual(state.random)
  })
})

describe('invalid external data versus diagnostic stops (AC6)', () => {
  const mutations: Array<[string, (s: Mutable<RunningState>) => void]> = [
    ['rules', (s) => { s.rules = 'unknown' as never }],
    ['lifeId', (s) => { s.lifeId = '' }],
    ['revision-negative', (s) => { s.revision = -1 }],
    ['revision-unsafe', (s) => { s.revision = Number.MAX_SAFE_INTEGER + 1 }],
    ['season-fraction', (s) => { s.seasonIndex = 0.5 }],
    ['season-unsafe', (s) => { s.seasonIndex = Number.MAX_SAFE_INTEGER + 1 }],
    ['stage', (s) => { s.stage = 'future-events' as never }],
    ['status', (s) => { s.status = 'paused' as never }],
    ['origin-seed', (s) => { s.origin.seed = 'bad' }],
    ['origin-family', (s) => { s.origin.birthFamily = 'unknown' as never }],
    ['origin-value', (s) => { s.origin.initialValues.health = -1 }],
    ['origin-version', (s) => { s.origin.versions.random = 'unknown' as never }],
    ['origin-random', (s) => { s.origin.startRandom.birth = [0, 0, 0, 0] }],
    ...(['life', 'flavor', 'birth'] as const).map((key): [string, (s: Mutable<RunningState>) => void] =>
      [`random-${key}`, (s) => { s.random[key] = [0, 0, 0, 0] }]),
    ...(['health', 'spirit', 'knowledge', 'connections'] as const).flatMap((key) =>
      [NaN, Infinity, -1, 101].map((n): [string, (s: Mutable<RunningState>) => void] =>
        [`${key}-${n}`, (s) => { s.person[key] = n }])),
    ...[-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1].map((n): [string, (s: Mutable<RunningState>) => void] =>
      [`funds-${n}`, (s) => { s.person.funds = n }]),
    ['history', (s) => { (s as unknown as { history: unknown[] }).history.push({ kind: 'empty-season' }) }],
  ]
  it.each(mutations)('refuses invalid %s without claiming a normal snapshot', (_, mutate) => {
    const state = structuredClone(initial()) as Mutable<RunningState>
    mutate(state)
    const before = structuredClone(state)
    const result = advanceCore(freeze(state), input(initial()))
    expect(result.kind).toBe('invalid-state')
    expect(result).not.toHaveProperty('state')
    expect(result).not.toHaveProperty('lastNormal')
    expect(state).toEqual(before)
    expect(copyCoreState(state).ok).toBe(false)
  })
  it.each([null, [], {}, { status: 'diagnostic-stop' }])('rejects missing state %#', (state) => {
    expect(advanceCore(state, input(initial())).kind).toBe('invalid-state')
  })
  it.each(['revision-exhausted', 'season-index-exhausted'] as const)('atomically stops for %s and preserves the prior normal state through JSON', (code) => {
    const state: RunningState = { ...initial(), stage: 'complete-season',
      revision: code === 'revision-exhausted' ? Number.MAX_SAFE_INTEGER : 7,
      seasonIndex: code === 'season-index-exhausted' ? Number.MAX_SAFE_INTEGER : 3 }
    const before = json(state)
    const result = advanceCore(freeze(state), input(state))
    expect(result.kind).toBe('diagnostic-stop')
    if (result.kind !== 'diagnostic-stop') return
    expect(result.state.lastNormal).toEqual(before)
    expect(result.state.cause).toMatchObject({ code, lifeId: state.lifeId,
      revision: state.revision, seasonIndex: state.seasonIndex, stage: state.stage })
    expect(state).toEqual(before)
    expect(checked(json(result.state))).toEqual(result.state)
    expect(advanceCore(freeze(result.state), input(state)).kind).toBe('rejected')
    expect(result.state.lastNormal.history).toEqual([])
    expect(result.state.lastNormal.random).toEqual(state.random)
    const bad = json(result.state) as Mutable<typeof result.state>
    bad.cause.seasonIndex = 0
    expect(copyCoreState(bad).ok).toBe(false)
  })
  it('refuses stale input before calculating and allows the final safe revision', () => {
    const state = { ...initial(), revision: Number.MAX_SAFE_INTEGER - 1 }
    const last = step(state)
    expect(last.revision).toBe(Number.MAX_SAFE_INTEGER)
    expect(advanceCore(last, input(state)).kind).toBe('rejected')
    expect(advanceCore(last, input(last)).kind).toBe('diagnostic-stop')
  })
  it('allows health checking at the last season index, then stops completion', () => {
    const state = { ...initial(), seasonIndex: Number.MAX_SAFE_INTEGER }
    const next = step(state)
    expect(next.seasonIndex).toBe(state.seasonIndex)
    expect(next.stage).toBe('complete-season')
    expect(advanceCore(next, input(next)).kind).toBe('diagnostic-stop')
    const zero = { ...initial(0), seasonIndex: Number.MAX_SAFE_INTEGER, stage: 'complete-season' as const }
    expect(step(zero).status).toBe('dead')
  })
  it('accepts safe funds above 100 without introducing a balance cap', () => {
    expect(run(initial(1, 0, Number.MAX_SAFE_INTEGER), 4).person.funds).toBe(Number.MAX_SAFE_INTEGER)
  })
  it.each(['health', 'history', 'age', 'season', 'cause', 'revision'] as const)('rejects inconsistent dead %s', (field) => {
    const dead = step(initial(0)) as Mutable<NormalState>
    if (field === 'health') dead.person.health = 1
    if (field === 'history') (dead as unknown as { history: unknown[] }).history.push(dead.history[0])
    if (field === 'revision') dead.revision = 0
    if (dead.status === 'dead') {
      if (field === 'age') dead.history[0].age = 1
      if (field === 'season') dead.history[0].season = 'winter'
      if (field === 'cause') dead.history[0].cause = 'funds-zero' as never
    }
    expect(copyCoreState(dead).ok).toBe(false)
  })
})
