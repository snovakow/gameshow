import type { Config, GameMode } from './config.ts'
import type { Random } from './random.ts'
import { finalCrate, hostOpens, randomCrate, type Choice } from './rules.ts'

// The settings that set the prizes
export type PrizeSettings = Pick<
  Config,
  'game' | 'prizes' | 'rounds' | 'target' | 'min' | 'max' | 'step'
>

// The odds of a win, as a fraction so the sums below stay in whole numbers: one in three for a
// pick alone, and two in three in Monty Hall mode, the odds when switching, so the player who
// always switches is the one who averages the target
function winOdds(game: GameMode) {
  return game === 'montyHall' ? { over: 2, under: 3 } : { over: 1, under: 3 }
}

// a / b rounded down, exactly, for a whole a and a positive whole b
function floorDiv(a: number, b: number): number {
  return (a - (((a % b) + b) % b)) / b
}

// over / under to the nearest multiple of the step, halves up. Whole numbers throughout, so an
// exact half such as 37.5 rounds up rather than drifting below by a floating-point error
function roundToStep(over: number, under: number, step: number): number {
  return floorDiv(2 * over + under * step, 2 * under * step) * step
}

// Each round's weight is its number, so prizes rise round by round; this is the weight of the
// rounds from this one to the last
function weightFrom(round: number, rounds: number): number {
  return ((rounds - round + 1) * (round + rounds)) / 2
}

// Pure odds: a fixed ladder that a player at the mode's odds averages the target on
export function ladder(settings: PrizeSettings): number[] {
  const { over, under } = winOdds(settings.game)
  const weight = weightFrom(1, settings.rounds)
  return Array.from({ length: settings.rounds }, (_, i) =>
    Math.max(
      settings.step,
      roundToStep(settings.target * (i + 1) * under, over * weight, settings.step),
    ),
  )
}

// A within-range prize and the bounds it was clamped to, which the tests check
export interface PrizeStep {
  prize: number
  low: number
  high: number
}

// Within range: the prize for a round (from 1), set just before it from the tab so far and the
// round before's prize. The low bound keeps prizes from falling; the high one spreads what's left
// below the max over the rounds still to play, so even winning every one stays within it
export function withinRangeStep(
  settings: PrizeSettings,
  round: number,
  total: number,
  previous: number,
): PrizeStep {
  const { rounds, target, max, step } = settings
  const final = round === rounds
  const { over, under } = winOdds(settings.game)
  // What the rest of the show should pay a player at the odds, its share for this round
  const aim = final
    ? target - total
    : roundToStep((target - total) * round * under, over * weightFrom(round, rounds), step)
  const low = Math.max(step, previous)
  const high = final ? max - total : floorDiv(max - total, (rounds - round + 1) * step) * step
  return { prize: Math.min(Math.max(aim, low), high), low, high }
}

// The prize for a round (from 1), in either mode, from the tab before it and the previous
// round's prize (0 before the first), so a resumed show recomputes it the same way
export function roundPrize(
  settings: PrizeSettings,
  round: number,
  total: number,
  previous: number,
): number {
  return settings.prizes === 'pureOdds'
    ? ladder(settings)[round - 1]
    : withinRangeStep(settings, round, total, previous).prize
}

// Within range, a show that ends below the min is lifted to it, a bonus for the occasion
export function bonus(settings: PrizeSettings, total: number): number {
  return settings.prizes === 'withinRange' && total < settings.min ? settings.min - total : 0
}

export interface Outcomes {
  least: number
  most: number
  average: number
  // The middle 80% of shows end from p10 to p90
  p10: number
  p90: number
  // The share of shows, 0 to 1, that pay the bonus
  bonusRate: number
  // Pure odds only
  ladder: number[] | null
}

// The lowest total that at least this share of shows reaches or falls below
function percentile(sorted: Float64Array, share: number): number {
  return sorted[Math.max(0, Math.ceil(share * sorted.length) - 1)]
}

// Plays whole shows by the rules, for the setup page's preview. The strategy is the Monty Hall
// player's, always staying or always switching; simple mode has no choice, so it's unused there
export function simulate(
  settings: PrizeSettings,
  strategy: Choice,
  games: number,
  random: Random,
): Outcomes {
  if (!Number.isSafeInteger(games) || games < 1) throw new RangeError('Simulate at least one game')
  const fixed = settings.prizes === 'pureOdds' ? ladder(settings) : null
  const totals = new Float64Array(games)
  let bonuses = 0
  for (let game = 0; game < games; game++) {
    let total = 0
    let previous = 0
    for (let round = 1; round <= settings.rounds; round++) {
      const prize = fixed ? fixed[round - 1] : withinRangeStep(settings, round, total, previous).prize
      const winner = randomCrate(random)
      const pick = randomCrate(random)
      const final =
        settings.game === 'montyHall'
          ? finalCrate(pick, hostOpens(pick, winner, random), strategy)
          : pick
      if (final === winner) total += prize
      previous = prize
    }
    const extra = bonus(settings, total)
    if (extra) bonuses++
    totals[game] = total + extra
  }
  totals.sort()
  return {
    least: totals[0],
    most: totals[games - 1],
    average: totals.reduce((sum, total) => sum + total, 0) / games,
    p10: percentile(totals, 0.1),
    p90: percentile(totals, 0.9),
    bonusRate: bonuses / games,
    ladder: fixed,
  }
}
