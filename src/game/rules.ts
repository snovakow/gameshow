import type { Random } from './random.ts'

// Crates are numbered from 0 here, and shown to the player from 1
export const crateCount = 3
const crates = Array.from({ length: crateCount }, (_, i) => i)

// After the host opens an empty crate, the player keeps the pick or takes the other closed one
export type Choice = 'stay' | 'switch'

// Uniform, so the prize is placed fairly and a simulated pick is as good as any other
export function randomCrate(random: Random): number {
  return Math.floor(random() * crateCount)
}

// The host opens a crate that is neither the pick nor the prize. When the pick holds the prize,
// both others are empty and she chooses between them at random, as the classic problem requires:
// a fixed choice would sometimes tell the player where the prize is
export function hostOpens(pick: number, prize: number, random: Random): number {
  const empties = crates.filter((crate) => crate !== pick && crate !== prize)
  return empties.length === 1 ? empties[0] : empties[Math.floor(random() * empties.length)]
}

// The one crate left closed beside the pick
export function otherCrate(pick: number, opened: number): number {
  return crates.filter((crate) => crate !== pick && crate !== opened)[0]
}

export function finalCrate(pick: number, opened: number, choice: Choice): number {
  return choice === 'stay' ? pick : otherCrate(pick, opened)
}

// A click on a crate while the offer stands: the pick stays, the other closed crate switches, and
// the opened one means nothing
export function choiceForCrate(crate: number, pick: number, opened: number): Choice | null {
  if (crate === pick) return 'stay'
  if (crate === otherCrate(pick, opened)) return 'switch'
  return null
}
