import type { CueName } from './director.ts'

// How a change to the lights comes and goes, in seconds: it rises to its full amount, holds there,
// then falls away. A hold without end lasts until the lights go back to rest
export interface Envelope {
  rise: number
  hold: number
  fall: number
}

// The bulbs' ways of running, as the marquee names them
export type BulbMode = 'chase' | 'race' | 'strobe' | 'dim'

// One change a cue makes to the studio's lights
export type LightChange =
  // The spot over the crate the player has chosen so far brightens to this many times its resting
  // brightness, and every other crate's spot goes back to rest, so one crate is lit at a time
  | { light: 'chosenSpot'; level: number; shape: Envelope }
  // The two coloured spots swing their pools across the stage, brighter as they go
  | { light: 'sweep'; shape: Envelope }
  // The crates' and the coloured spots flash together, in step with the bulbs' strobe
  | { light: 'strobe'; shape: Envelope }
  // Every light but the rings drops to this fraction of its brightness
  | { light: 'dim'; level: number; shape: Envelope }
  // The rings take on a colour and lose it again
  | { light: 'rings'; colour: 'gold' | 'blue'; shape: Envelope }
  // The bulbs run this way for this long, then chase again; for good where it has no end
  | { light: 'bulbs'; mode: BulbMode; seconds: number }
  // Every change still showing fades away, and the bulbs chase again
  | { light: 'rest' }

// The strobe flashes this many times a second, under the three a second at which flashes across
// much of the view can bring on a seizure in people with photosensitive epilepsy
export const strobeRate = 2

// Whether the strobe is in its lit half at a time in seconds, as the bulbs reckon it
export function strobeLit(seconds: number): boolean {
  const phase = seconds * strobeRate
  return phase - Math.floor(phase) >= 0.5
}

// How long a win's flashing lasts, and a loss's darkness
const strobeSeconds = 3
const dim: Envelope = { rise: 0.4, hold: 1.2, fall: 1.2 }

// What each of the show's cues does to the lights. Every cue has its row, so one added to the show
// can't go unlit by being forgotten here; those the lights leave alone have an empty one
export const lightCues: Record<CueName, readonly LightChange[]> = {
  showStart: [{ light: 'sweep', shape: { rise: 0.6, hold: 3, fall: 1.2 } }],
  roundStart: [{ light: 'rest' }],
  pick: [{ light: 'chosenSpot', level: 3, shape: { rise: 0.3, hold: Infinity, fall: 0.8 } }],
  hostOpens: [],
  dud: [],
  stay: [],
  switch: [],
  // The bulbs race until the reveal
  drumroll: [{ light: 'bulbs', mode: 'race', seconds: Infinity }],
  // The final crate is lit until the player moves on, the pick's spot giving way to it
  reveal: [
    { light: 'chosenSpot', level: 4, shape: { rise: 0.2, hold: Infinity, fall: 0.8 } },
    { light: 'bulbs', mode: 'chase', seconds: Infinity },
  ],
  win: [
    { light: 'strobe', shape: { rise: 0, hold: strobeSeconds, fall: 0 } },
    { light: 'bulbs', mode: 'strobe', seconds: strobeSeconds },
    { light: 'rings', colour: 'gold', shape: { rise: 0.4, hold: 2.5, fall: 1.5 } },
  ],
  // Dark for a moment, and the rings stay blue until the player moves on
  lose: [
    { light: 'dim', level: 0.3, shape: dim },
    { light: 'bulbs', mode: 'dim', seconds: dim.rise + dim.hold + dim.fall },
    { light: 'rings', colour: 'blue', shape: { rise: 1, hold: Infinity, fall: 1.2 } },
  ],
  next: [{ light: 'rest' }],
  bonus: [],
  finale: [{ light: 'sweep', shape: { rise: 0.6, hold: 6, fall: 1.5 } }],
}

// A smooth step from 0 to 1, starting and ending still
const ease = (x: number) => (1 - Math.cos(Math.PI * Math.min(Math.max(x, 0), 1))) / 2

// How much of a change shows, from 0 to 1, this many seconds after it began
export function envelope(elapsed: number, { rise, hold, fall }: Envelope): number {
  if (elapsed < 0) return 0
  if (elapsed < rise) return ease(elapsed / rise)
  const held = elapsed - rise
  if (held < hold) return 1
  const falling = held - hold
  if (falling < fall) return 1 - ease(falling / fall)
  return 0
}
