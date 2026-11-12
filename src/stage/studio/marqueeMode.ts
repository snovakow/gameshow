import { uniform } from 'three/tsl'

// The ways the bulbs can run, for a cue to pick by setting the mode below: a chase stepping
// round the sign, a single light racing round it, all of them flashing together, or all dimmed
export const marqueeModes = { chase: 0, race: 1, strobe: 2, dim: 3 } as const
export type MarqueeMode = (typeof marqueeModes)[keyof typeof marqueeModes]

// Which way the bulbs run now. A uniform, so a change reaches the next frame without a new shader
const firstMode: number = marqueeModes.chase
export const marqueeMode = uniform(firstMode)
