import { Color } from 'three'
import {
  abs,
  float,
  fract,
  length,
  max,
  mix,
  positionWorld,
  pow,
  sub,
  time,
  uniform,
} from 'three/tsl'
import { useEffects } from '../effects.ts'

// The rings' colour near the middle of the stage and out toward its edge, uniforms so a cue can
// change them without rebuilding a shader
export const ringColours = {
  inner: uniform(new Color(0x74ccf4)),
  outer: uniform(new Color(0x7f00c5)),
}

// The panel's Ring glow, which the studio floor keeps in step with the panel
export const ringBrightness = uniform(useEffects.getState().ringBrightness)

// The rings span five to a world unit of the pattern's own space, which is a tenth of the stage's,
// so one ring every two units, each moving out by one ring every two seconds
const pattern = positionWorld.xz.mul(0.1)
const ringsPerUnit = 5
const travel = fract(time.mul(0.5))
// Where each ring is brightest, half way between one and the next
const ringRadius = float(0.5)
// How sharply each ring falls off from its brightest line, and how bright it is there
const sharpness = 0.8
const power = 0.006
// The width of the soft halo either side of each ring
const halo = 0.8

// Rings rippling out from the middle of the stage, after webgpu_reflection_blurred's circles:
// the distance to the nearest ring's line, and a brightness falling off steeply either side of it
const offset = fract(length(pattern).mul(ringsPerUnit).sub(travel)).sub(ringRadius)
const intensity = pow(ringRadius.div(abs(offset)), sharpness)
// Inner colour at the middle, the outer one ten units out
const tint = mix(ringColours.inner, ringColours.outer, positionWorld.xz.length().div(10).clamp())
const ring = tint.mul(intensity).mul(power).mul(max(sub(halo, abs(offset)), 0))
// Fading out up the stage, gone by about 1.4 units, so it lights the crates' feet and not the sky
const fade = positionWorld.y.mul(0.7).oneMinus().max(0)

// The rings at each point they touch: what the floor emits, and, scaled up, the colour of the
// light that carries them onto the crates and the host
export const rings = ring.mul(fade).mul(ringBrightness)
