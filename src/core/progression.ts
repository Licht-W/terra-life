import { copyBirthDraft } from './birth'
import type { BasicValues, BirthOrigin } from './birth'
import { copyRandomState } from './random'
import type { RandomState, RandomStreams } from './random'

export const PROGRESSION_RULES = 'tl-m1-003-empty-season-1'
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
type Stage = 'check-health' | 'complete-season'
type DeathRecord = Readonly<{
  kind: 'death'; cause: 'health-zero'; seasonIndex: number; age: number
  season: typeof SEASONS[number]
}>
type CommonState = Readonly<{
  rules: typeof PROGRESSION_RULES; lifeId: string; revision: number
  seasonIndex: number; stage: Stage; origin: BirthOrigin
  person: BasicValues; random: RandomStreams
}>
export type RunningState = CommonState & Readonly<{ status: 'running'; history: readonly [] }>
export type DeadState = CommonState & Readonly<{ status: 'dead'; history: readonly [DeathRecord] }>
export type NormalState = RunningState | DeadState
type StopCode = 'revision-exhausted' | 'season-index-exhausted'
export type DiagnosticStop = Readonly<{
  status: 'diagnostic-stop'; lastNormal: RunningState
  cause: Readonly<{ code: StopCode; message: string; lifeId: string
    revision: number; seasonIndex: number; stage: Stage }>
}>
export type CoreState = NormalState | DiagnosticStop
export type AdvanceInput = Readonly<{ kind: 'advance'; lifeId: string; expectedRevision: number }>
export type CoreResult =
  | Readonly<{ kind: 'accepted'; state: NormalState }>
  | Readonly<{ kind: 'rejected'; reason: string }>
  | Readonly<{ kind: 'invalid-state'; reason: string }>
  | Readonly<{ kind: 'diagnostic-stop'; state: DiagnosticStop }>
type Checked<T> = { ok: true; value: T } | { ok: false; reason: string }

function invalid(reason: string): Checked<never> { return { ok: false, reason } }
function record(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}
function text(input: unknown): input is string {
  return typeof input === 'string' && input.trim().length > 0
}
function counter(input: unknown): input is number {
  return typeof input === 'number' && Number.isSafeInteger(input) && input >= 0
}
function streams(input: unknown): Checked<RandomStreams> {
  if (!record(input)) return invalid('Missing random streams.')
  const copied = {} as Record<keyof RandomStreams, RandomState>
  for (const key of ['life', 'flavor', 'birth'] as const) {
    const result = copyRandomState(input[key])
    if (!result.ok) return invalid(`${key}: ${result.error}`)
    copied[key] = result.value
  }
  return { ok: true, value: copied }
}
function values(input: unknown): Checked<BasicValues> {
  if (!record(input)) return invalid('Missing person values.')
  for (const key of ['health', 'spirit', 'knowledge', 'connections'] as const) {
    const n = input[key]
    // Existing P01 provisional range, without rounding or a new ability cap.
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100) {
      return invalid(`Invalid ${key}.`)
    }
  }
  if (!counter(input.funds)) return invalid('Funds must be a nonnegative safe integer (numeric safety, not a balance cap).')
  return { ok: true, value: { health: input.health as number, spirit: input.spirit as number,
    knowledge: input.knowledge as number, connections: input.connections as number, funds: input.funds } }
}
function origin(input: unknown): Checked<BirthOrigin> {
  if (!record(input)) return invalid('Missing birth origin.')
  // Reuse the birth boundary's version, seed, family and initial-value contract.
  // This only validates/copies; it neither draws nor replays the birth.
  const checked = copyBirthDraft({ phase: 'draft', seed: input.seed, rerollCount: input.rerollCount,
    versions: input.versions, candidate: { country: input.country, species: input.species,
      family: input.birthFamily, values: input.initialValues }, random: input.startRandom })
  if (!checked.ok) return invalid(`Origin: ${checked.error.message}`)
  const d = checked.value
  return { ok: true, value: { seed: d.seed, rerollCount: d.rerollCount, versions: d.versions,
    country: d.candidate.country, species: d.candidate.species, birthFamily: d.candidate.family,
    initialValues: d.candidate.values, startRandom: d.random } }
}
function sameValues(a: BasicValues, b: BasicValues): boolean {
  return (['health', 'spirit', 'funds', 'knowledge', 'connections'] as const).every((key) => a[key] === b[key])
}
function sameStreams(a: RandomStreams, b: RandomStreams): boolean {
  return (['life', 'flavor', 'birth'] as const).every((key) => a[key].every((word, i) => word === b[key][i]))
}
function deathRecord(seasonIndex: number): DeathRecord {
  return { kind: 'death', cause: 'health-zero', seasonIndex,
    age: Math.floor(seasonIndex / 4), season: SEASONS[seasonIndex % 4] }
}
function normal(input: unknown): Checked<NormalState> {
  if (!record(input) || input.rules !== PROGRESSION_RULES || !text(input.lifeId)
    || !counter(input.revision) || !counter(input.seasonIndex)
    || (input.stage !== 'check-health' && input.stage !== 'complete-season')
    || (input.status !== 'running' && input.status !== 'dead') || !Array.isArray(input.history)) {
    return invalid('Invalid progression identity, version, counters, stage, status or history.')
  }
  const o = origin(input.origin)
  if (!o.ok) return o
  const p = values(input.person)
  if (!p.ok) return p
  const r = streams(input.random)
  if (!r.ok) return r
  const common: CommonState = { rules: PROGRESSION_RULES, lifeId: input.lifeId,
    revision: input.revision, seasonIndex: input.seasonIndex, stage: input.stage,
    origin: o.value, person: p.value, random: r.value }
  if (input.status === 'running') {
    if (input.history.length !== 0) return invalid('This empty-season running state must have no life records.')
    return { ok: true, value: { ...common, status: 'running', history: [] } }
  }
  const expected = deathRecord(common.seasonIndex)
  const d: unknown = input.history[0]
  if (p.value.health !== 0 || input.revision === 0 || input.history.length !== 1 || !record(d)
    || d.kind !== expected.kind || d.cause !== expected.cause || d.seasonIndex !== expected.seasonIndex
    || d.age !== expected.age || d.season !== expected.season) return invalid('Inconsistent death state or record.')
  return { ok: true, value: { ...common, status: 'dead', history: [expected] } }
}
function stopCode(state: RunningState): StopCode | undefined {
  if (state.revision === Number.MAX_SAFE_INTEGER) return 'revision-exhausted'
  if (state.person.health > 0 && state.stage === 'complete-season'
    && state.seasonIndex === Number.MAX_SAFE_INTEGER) return 'season-index-exhausted'
  return undefined
}
function stopped(state: RunningState, code: StopCode): DiagnosticStop {
  return { status: 'diagnostic-stop', lastNormal: state, cause: { code,
    message: code === 'revision-exhausted' ? 'Revision cannot be incremented exactly.' : 'Season index cannot be incremented exactly.',
    lifeId: state.lifeId, revision: state.revision, seasonIndex: state.seasonIndex, stage: state.stage } }
}

/** JSON boundary, not save migration, provenance authentication or full history replay.
 * Invalid external data never becomes lastNormal. Unknown extra fields are discarded.
 */
export function copyCoreState(input: unknown): Checked<CoreState> {
  if (!record(input) || input.status !== 'diagnostic-stop') return normal(input)
  const previous = normal(input.lastNormal)
  if (!previous.ok) return previous
  if (previous.value.status !== 'running') return invalid('A diagnostic stop needs a running lastNormal.')
  const code = stopCode(previous.value)
  if (!code) return invalid('Diagnostic cause does not match the last normal state.')
  const expected = stopped(previous.value, code)
  const cause = input.cause
  if (!record(cause) || Object.entries(expected.cause).some(([key, value]) => cause[key] !== value)) {
    return invalid('Invalid diagnostic cause or location.')
  }
  return { ok: true, value: expected }
}

/** lifeId is supplied by the caller and must distinguish lives in its own scope.
 * Re-evaluating the same immutable input is deterministic, not a global lock.
 */
export function connectBirth(input: unknown, lifeId: unknown): CoreResult {
  if (!record(input)) return { kind: 'invalid-state', reason: 'Missing started birth.' }
  if (input.phase === 'draft') return { kind: 'rejected', reason: 'Birth must be started before connection.' }
  if (input.phase !== 'started' || input.seasonIndex !== 0) return { kind: 'invalid-state', reason: 'Invalid started birth phase or season.' }
  if (!text(lifeId)) return { kind: 'rejected', reason: 'A nonempty caller-supplied lifeId is required.' }
  const o = origin(input.origin)
  const p = values(input.person)
  const r = streams(input.random)
  if (!o.ok) return { kind: 'invalid-state', reason: o.reason }
  if (!p.ok) return { kind: 'invalid-state', reason: p.reason }
  if (!r.ok) return { kind: 'invalid-state', reason: r.reason }
  if (!sameValues(p.value, o.value.initialValues) || !sameStreams(r.value, o.value.startRandom)) {
    return { kind: 'invalid-state', reason: 'Started birth differs from its initial snapshot.' }
  }
  return { kind: 'accepted', state: { rules: PROGRESSION_RULES, lifeId, revision: 0,
    seasonIndex: 0, stage: 'check-health', status: 'running', origin: o.value,
    person: p.value, random: r.value, history: [] } }
}

/** One atomic step: check health, then complete this season on the next input.
 * No automatic loop, event draws, economic changes or empty life records.
 */
export function advanceCore(inputState: unknown, input: unknown): CoreResult {
  const checked = copyCoreState(inputState)
  if (!checked.ok) return { kind: 'invalid-state', reason: checked.reason }
  const state = checked.value
  if (!record(input) || input.kind !== 'advance' || !text(input.lifeId) || !counter(input.expectedRevision)) {
    return { kind: 'rejected', reason: 'Invalid advance input.' }
  }
  if (state.status === 'diagnostic-stop') return { kind: 'rejected', reason: 'Diagnostic stop cannot advance.' }
  if (input.lifeId !== state.lifeId) return { kind: 'rejected', reason: 'Input targets another life.' }
  if (input.expectedRevision !== state.revision) return { kind: 'rejected', reason: 'Input revision does not match.' }
  if (state.status === 'dead') return { kind: 'rejected', reason: 'Life has already ended.' }
  const code = stopCode(state)
  if (code) return { kind: 'diagnostic-stop', state: stopped(state, code) }
  const revision = state.revision + 1
  // Health is also checked at completion, so a valid zero-health snapshot cannot advance the season.
  if (state.person.health === 0) {
    return { kind: 'accepted', state: { ...state, revision, status: 'dead', history: [deathRecord(state.seasonIndex)] } }
  }
  return { kind: 'accepted', state: state.stage === 'check-health'
    ? { ...state, revision, stage: 'complete-season' }
    : { ...state, revision, seasonIndex: state.seasonIndex + 1, stage: 'check-health' } }
}
