import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector2, Vector3 } from 'three'
import { uniform } from 'three/tsl'
import { envelope, type Envelope } from '../../game/lightCues.ts'
import { useCelebrationCues } from './useCelebrationCues.ts'

// How strongly the picture is drawn outward toward the burst's centre: each step of the blur
// weighs this much against the picture underneath. At 0 the blur is skipped and the picture is
// drawn as it is
export const burstStrength = uniform(0)
// The winning crate's place on the screen, as the render pipeline's quad reads its picture: x
// across from the left and y down from the top, each 0 to 1
export const burstCentre = uniform(new Vector2(0.5, 0.5))

// The burst at its height, where a nearer 1 would smear the frame past reading
const burstPeak = 0.85
// Quick out, a little slower back, and over within half a second of the win
const burstShape: Envelope = { rise: 0.1, hold: 0, fall: 0.35 }
// Where on the crate it bursts from: above its middle, where the prize rises
const burstHeight = 0.6

// Where the crates stand, on x and z
type Places = [number, number][]

const seconds = () => performance.now() / 1000

// Times the zoom burst from the show's win, and follows the winning crate across the screen while
// the camera pulls back, through the two uniforms the pipeline's burst reads, so nothing is
// rebuilt for a burst. Mounted by the pipeline while the burst is switched on
export function ZoomBurst({ crates }: { crates: Places }) {
  const burst = useRef({ start: -Infinity, crate: 0 })
  const point = useRef(new Vector3())

  useCelebrationCues({
    onCue: (name, final) => {
      if (name !== 'win' || final === null) return
      burst.current.start = seconds()
      burst.current.crate = final
    },
    onReset: () => {
      burst.current.start = -Infinity
    },
  })

  useFrame(({ camera }) => {
    const { start, crate } = burst.current
    const shown = envelope(seconds() - start, burstShape)
    burstStrength.value = burstPeak * shown
    if (shown === 0) return
    const [x, z] = crates[crate] ?? [0, 0]
    const projected = point.current.set(x, burstHeight, z).project(camera)
    burstCentre.value.set((projected.x + 1) / 2, (1 - projected.y) / 2)
  })

  return null
}
