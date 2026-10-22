import type { BirthConfig, WeightedCandidate } from '../core/birth'

// TL-M1-002 / D09 verification values only. Not lore or adopted game balance.
// Array order and draw order belong to the data/rules versions; change IDs on edits.
function numbers(values: readonly number[], weights: readonly number[]): readonly WeightedCandidate<number>[] {
  return values.map((value, index) => ({ id: `value-${index}`, value, weight: weights[index] }))
}

export const BIRTH_FIXTURE: BirthConfig = {
  dataVersion: 'tl-m1-002-birth-fixture-1',
  tuningVersion: 'tl-m1-002-verification-1',
  families: [
    { id: 'family-day-to-day', value: 'dayToDay', weight: 1 },
    { id: 'family-frugal', value: 'frugal', weight: 2 },
    { id: 'family-modest', value: 'modest', weight: 4 },
    { id: 'family-comfortable', value: 'comfortable', weight: 2 },
    { id: 'family-wealthy', value: 'wealthy', weight: 1 },
  ],
  basic: {
    health: numbers([40, 70, 100], [1, 2, 1]),
    spirit: numbers([30, 60, 90], [1, 2, 1]),
    knowledge: numbers([0, 5, 10], [2, 2, 1]),
    connections: numbers([0, 5, 10], [2, 2, 1]),
  },
  funds: {
    dayToDay: numbers([0, 10, 30], [4, 2, 1]),
    frugal: numbers([0, 10, 30], [2, 4, 1]),
    modest: numbers([10, 30, 60], [2, 4, 1]),
    comfortable: numbers([30, 60, 120], [2, 4, 1]),
    wealthy: numbers([30, 120, 200], [1, 2, 4]),
  },
}
