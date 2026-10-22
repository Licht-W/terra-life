import { copyRandomState, createRandomStreams, nextUint32, uint32ToUnit } from './random'
import type { RandomState, RandomStreams } from './random'

/** Terra Life categories, not official social classes or residential settings. */
export const BIRTH_FAMILIES = [
  { key: 'dayToDay', name: '日々をしのぐ暮らし', meaning: '食料・住居・医療の確保にも苦労する、生活基盤が非常に弱い家庭' },
  { key: 'frugal', name: '切り詰めた暮らし', meaning: '基本的な生活は維持しているが、経済的な余裕がほとんどない家庭' },
  { key: 'modest', name: 'つつましい暮らし', meaning: '日常生活はおおむね安定しているが、大きな支出には工夫が必要な家庭' },
  { key: 'comfortable', name: 'ゆとりのある暮らし', meaning: '安定した経済基盤があり、教育・治療などにも比較的余裕がある家庭' },
  { key: 'wealthy', name: '裕福な暮らし', meaning: '十分な蓄えや経済基盤を持ち、高額な支出や継続的な支援も可能な家庭' },
] as const

export type BirthFamily = typeof BIRTH_FAMILIES[number]['key']
export type BasicValues = Readonly<{
  health: number; spirit: number; funds: number; knowledge: number; connections: number
}>
export type WeightedCandidate<T> = Readonly<{ id: string; value: T; weight: number }>
export type BirthConfig = Readonly<{
  dataVersion: string
  tuningVersion: string
  families: readonly WeightedCandidate<BirthFamily>[]
  basic: Readonly<Record<BasicKey, readonly WeightedCandidate<number>[]>>
  funds: Readonly<Record<BirthFamily, readonly WeightedCandidate<number>[]>>
}>

// Order is part of the rules contract: family, health, spirit, funds, knowledge, connections.
const BASIC_KEYS = ['health', 'spirit', 'knowledge', 'connections'] as const
type BasicKey = typeof BASIC_KEYS[number]
export const BIRTH_RULES_VERSION = 'tl-birth-rules-1'
export const BIRTH_RANDOM_CONTRACT = 'xoshiro128ss-1.1_splitmix64-low-high_life-jump-flavor-jump-birth-v1'
type BirthVersions = Readonly<{
  rules: typeof BIRTH_RULES_VERSION; random: typeof BIRTH_RANDOM_CONTRACT
  data: string; tuning: string
}>
export type BirthCandidate = Readonly<{
  country: 'ヴィクトリア'; species: 'フェリーン'; family: BirthFamily; values: BasicValues
}>
export type BirthDraft = Readonly<{
  phase: 'draft'; seed: string; rerollCount: number; versions: BirthVersions
  candidate: BirthCandidate; random: RandomStreams
}>
export type BirthOrigin = Readonly<{
  seed: string; rerollCount: number; versions: BirthVersions
  country: 'ヴィクトリア'; species: 'フェリーン'; birthFamily: BirthFamily
  initialValues: BasicValues; startRandom: RandomStreams
}>
export type StartedBirth = Readonly<{
  phase: 'started'; seasonIndex: 0; person: BasicValues
  origin: BirthOrigin; random: RandomStreams
}>
type ErrorKind = 'invalid-config' | 'invalid-seed' | 'invalid-state' | 'rejected'
export type BirthResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly kind: ErrorKind; readonly message: string } }

function fail(kind: ErrorKind, message: string): BirthResult<never> {
  return { ok: false, error: { kind, message } }
}
function record(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}
function text(input: unknown): input is string {
  return typeof input === 'string' && input.trim().length > 0
}
function family(input: unknown): input is BirthFamily {
  return BIRTH_FAMILIES.some(({ key }) => key === input)
}
function basicValue(input: unknown): input is number {
  // The prototype range only; fractional ability values are not globally prohibited.
  return typeof input === 'number' && Number.isFinite(input) && input >= 0 && input <= 100
}
function fundsValue(input: unknown): input is number {
  // JS exact-integer safety, not a gameplay balance cap.
  return typeof input === 'number' && Number.isSafeInteger(input) && input >= 0
}

function table<T>(input: unknown, accepts: (value: unknown) => value is T,
  path: string): BirthResult<readonly WeightedCandidate<T>[]> {
  if (!Array.isArray(input) || input.length === 0) return fail('invalid-config', `${path}: missing candidates.`)
  const ids = new Set<string>()
  const copied: WeightedCandidate<T>[] = []
  let total = 0
  for (const entry of input) {
    if (!record(entry) || !text(entry.id) || ids.has(entry.id)) {
      return fail('invalid-config', `${path}: missing or duplicate candidate ID.`)
    }
    ids.add(entry.id)
    if (!accepts(entry.value)) return fail('invalid-config', `${path}/${entry.id}: invalid candidate value.`)
    if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight) || entry.weight < 0) {
      return fail('invalid-config', `${path}/${entry.id}: weight must be finite and nonnegative.`)
    }
    const nextTotal = total + entry.weight
    if (!Number.isFinite(nextTotal) || (entry.weight > 0 && nextTotal === total)) {
      return fail('invalid-config', `${path}/${entry.id}: weight sum is nonfinite or loses positive weight precision.`)
    }
    total = nextTotal
    copied.push({ id: entry.id, value: entry.value, weight: entry.weight })
  }
  return total > 0 ? { ok: true, value: copied } : fail('invalid-config', `${path}: total weight must be positive.`)
}

/** Full validation before any draw, including the unselected families' funds. */
function configCopy(input: unknown): BirthResult<BirthConfig> {
  if (!record(input) || !text(input.dataVersion) || !text(input.tuningVersion)
    || !record(input.basic) || !record(input.funds)) {
    return fail('invalid-config', 'Missing birth config, versions, basic tables or family funds tables.')
  }
  const families = table(input.families, family, 'families')
  if (!families.ok) return families
  if (new Set(families.value.map(({ value }) => value)).size !== BIRTH_FAMILIES.length
    || families.value.length !== BIRTH_FAMILIES.length) {
    return fail('invalid-config', 'families: each of the five known families must appear exactly once (zero weight allowed).')
  }
  if (Object.keys(input.basic).some((key) => !BASIC_KEYS.some((known) => known === key))
    || Object.keys(input.funds).some((key) => !family(key))) {
    return fail('invalid-config', 'Unknown basic table or family funds key.')
  }
  const basic = {} as Record<BasicKey, readonly WeightedCandidate<number>[]>
  for (const key of BASIC_KEYS) {
    const checked = table(input.basic[key], basicValue, `basic.${key}`)
    if (!checked.ok) return checked
    basic[key] = checked.value
  }
  const funds = {} as Record<BirthFamily, readonly WeightedCandidate<number>[]>
  for (const { key } of BIRTH_FAMILIES) {
    const checked = table(input.funds[key], fundsValue, `funds.${key}`)
    if (!checked.ok) return checked
    funds[key] = checked.value
  }
  return { ok: true, value: { dataVersion: input.dataVersion, tuningVersion: input.tuningVersion,
    families: families.value, basic, funds } }
}

function streamsCopy(input: unknown): BirthResult<RandomStreams> {
  if (!record(input)) return fail('invalid-state', 'Missing random streams.')
  const streams = {} as Record<keyof RandomStreams, RandomState>
  for (const key of ['life', 'flavor', 'birth'] as const) {
    const checked = copyRandomState(input[key])
    if (!checked.ok) return fail('invalid-state', `${key}: ${checked.error}`)
    streams[key] = checked.value
  }
  return { ok: true, value: streams }
}

/** Non-consuming boundary for JSON/copy resumption; no full replay or save migration. */
export function copyBirthDraft(input: unknown): BirthResult<BirthDraft> {
  if (!record(input)) return fail('invalid-state', 'Missing birth draft.')
  if (input.phase === 'started') return fail('rejected', 'Birth is already fixed; reroll and start are unavailable.')
  if (input.phase !== 'draft') return fail('invalid-state', 'Unknown birth phase.')
  // Validate canonical syntax without reinitializing/jumping streams on every read.
  if (typeof input.seed !== 'string' || !/^[0-9a-f]{16}$/.test(input.seed) || input.seed.length !== 16) {
    return fail('invalid-state', 'Draft seed must be 16 lowercase hexadecimal characters.')
  }
  if (!Number.isSafeInteger(input.rerollCount) || (input.rerollCount as number) < 0) {
    return fail('invalid-state', 'Reroll count must be a nonnegative safe integer.')
  }
  const versions = input.versions
  if (!record(versions) || versions.rules !== BIRTH_RULES_VERSION || versions.random !== BIRTH_RANDOM_CONTRACT
    || !text(versions.data) || !text(versions.tuning)) return fail('invalid-state', 'Invalid or unsupported birth versions.')
  const candidate = input.candidate
  if (!record(candidate) || candidate.country !== 'ヴィクトリア' || candidate.species !== 'フェリーン'
    || !family(candidate.family) || !record(candidate.values)) return fail('invalid-state', 'Invalid birth candidate.')
  for (const key of BASIC_KEYS) {
    if (!basicValue(candidate.values[key])) return fail('invalid-state', `Invalid candidate ${key}.`)
  }
  if (!fundsValue(candidate.values.funds)) return fail('invalid-state', 'Invalid candidate funds.')
  const random = streamsCopy(input.random)
  if (!random.ok) return random
  const values = candidate.values as BasicValues
  return { ok: true, value: { phase: 'draft', seed: input.seed, rerollCount: input.rerollCount as number,
    versions: { rules: versions.rules, random: versions.random, data: versions.data, tuning: versions.tuning },
    candidate: { country: candidate.country, species: candidate.species, family: candidate.family,
      values: { health: values.health, spirit: values.spirit, funds: values.funds,
        knowledge: values.knowledge, connections: values.connections } }, random: random.value } }
}

function draw<T>(candidates: readonly WeightedCandidate<T>[], state: RandomState): BirthResult<{ value: T; state: RandomState }> {
  const effective = candidates.filter(({ weight }) => weight > 0)
  if (effective.length === 1) return { ok: true, value: { value: effective[0].value, state } }
  const next = nextUint32(state)
  if (!next.ok) return fail('invalid-state', next.error)
  const unit = uint32ToUnit(next.value.output)
  if (!unit.ok) return fail('invalid-state', unit.error)
  const total = effective.reduce((sum, { weight }) => sum + weight, 0)
  let cumulative = 0
  for (const entry of effective) {
    cumulative += entry.weight
    // Compare normalized thresholds, avoiding unit * subnormal-total rounding to total.
    if (unit.value < cumulative / total) return { ok: true, value: { value: entry.value, state: next.value.state } }
  }
  return fail('invalid-config', 'No weighted interval selected; birth draw was not committed.')
}

function generate(config: BirthConfig, random: RandomStreams): BirthResult<{ candidate: BirthCandidate; random: RandomStreams }> {
  let birth = random.birth
  const selectedFamily = draw(config.families, birth)
  if (!selectedFamily.ok) return selectedFamily
  birth = selectedFamily.value.state
  const selected: Partial<Record<keyof BasicValues, number>> = {}
  // Family is consulted only here for funds; the other four use shared tables.
  const tables = [config.basic.health, config.basic.spirit, config.funds[selectedFamily.value.value],
    config.basic.knowledge, config.basic.connections]
  const keys = ['health', 'spirit', 'funds', 'knowledge', 'connections'] as const
  for (let index = 0; index < keys.length; index += 1) {
    const result = draw(tables[index], birth)
    if (!result.ok) return result
    selected[keys[index]] = result.value.value
    birth = result.value.state
  }
  return { ok: true, value: { candidate: { country: 'ヴィクトリア', species: 'フェリーン',
    family: selectedFamily.value.value, values: selected as BasicValues }, random: { ...random, birth } } }
}

/** Failure has no value/state: caller retains its last successful input, if any. */
export function createBirthDraft(seed: unknown, inputConfig: unknown): BirthResult<BirthDraft> {
  const config = configCopy(inputConfig)
  if (!config.ok) return config
  const random = createRandomStreams(seed)
  if (!random.ok) return fail('invalid-seed', random.error)
  const generated = generate(config.value, random.value)
  if (!generated.ok) return generated
  return { ok: true, value: { phase: 'draft', seed: seed as string, rerollCount: 0,
    versions: { rules: BIRTH_RULES_VERSION, random: BIRTH_RANDOM_CONTRACT,
      data: config.value.dataVersion, tuning: config.value.tuningVersion }, ...generated.value } }
}

export function rerollBirth(input: unknown, inputConfig: unknown): BirthResult<BirthDraft> {
  const draft = copyBirthDraft(input)
  if (!draft.ok) return draft
  const config = configCopy(inputConfig)
  if (!config.ok) return config
  if (draft.value.versions.data !== config.value.dataVersion || draft.value.versions.tuning !== config.value.tuningVersion) {
    return fail('invalid-config', 'Birth data/tuning versions changed during candidate selection.')
  }
  if (draft.value.rerollCount === Number.MAX_SAFE_INTEGER) return fail('invalid-state', 'Reroll count cannot be incremented exactly.')
  const generated = generate(config.value, draft.value.random)
  if (!generated.ok) return generated
  return { ok: true, value: { ...draft.value, ...generated.value, rerollCount: draft.value.rerollCount + 1 } }
}

export function startBirth(input: unknown): BirthResult<StartedBirth> {
  const draft = copyBirthDraft(input)
  if (!draft.ok) return draft
  const { seed, rerollCount, versions, candidate, random } = draft.value
  const startRandom = streamsCopy(random)
  if (!startRandom.ok) return startRandom
  return { ok: true, value: { phase: 'started', seasonIndex: 0, person: { ...candidate.values }, random,
    origin: { seed, rerollCount, versions, country: candidate.country, species: candidate.species,
      birthFamily: candidate.family, initialValues: { ...candidate.values }, startRandom: startRandom.value } } }
}
