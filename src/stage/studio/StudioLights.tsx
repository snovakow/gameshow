import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { HemisphereLight, MathUtils, SpotLight } from 'three'
import { Fn, atan, length, sin, smoothstep, time, vec3 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { useEffects } from '../effects.ts'

// A faint blue from above and near black from below, so what no spot reaches stays readable
const fillSky = 0x3a4680
const fillGround = 0x08080f
const fillIntensity = 1.2

// The key light, high in front of the host and a little to the camera's side, wide enough to take
// in the crates around her as well. It alone casts shadows in the studio
const key = {
  colour: 0xfff1dc,
  intensity: 110,
  position: [2.2, 5, 5.5],
  target: [0, 0.6, 0.3],
  angle: MathUtils.degToRad(26),
  penumbra: 0.5,
} as const
// The nearest and farthest a shadow is drawn from the key light, which stands about 6 units from
// the host, so the map's depth is spent on the stage
const keyShadowNear = 2
const keyShadowFar = 12
// Lifts the shadow's depth test just enough that the lit surfaces don't shadow themselves
const keyShadowBias = -0.0004
const keyShadowNormalBias = 0.02

// A dim warm spot straight over each crate, from this high
const crateSpot = {
  colour: 0xffe2b0,
  intensity: 9,
  height: 3.2,
  angle: MathUtils.degToRad(18),
  penumbra: 0.6,
} as const

type Place = readonly [number, number, number]
interface ColourSpot {
  colour: number
  position: Place
  target: Place
  spin: number
}

// Two coloured spots from high at the back corners, crossing on the stage, each projecting a
// turning pattern
const colourSpots: readonly ColourSpot[] = [
  { colour: 0xff3d9a, position: [-3.5, 4.5, -1], target: [0.6, 0, 0.8], spin: 0.35 },
  { colour: 0x3dd8ff, position: [3.5, 4.5, -1], target: [-0.6, 0, 0.8], spin: -0.35 },
]
const colourSpotIntensity = 45
const colourSpotAngle = MathUtils.degToRad(24)
const colourSpotPenumbra = 0.35
// The pattern's spokes round the spot, and rings out from its middle
const spokes = 7
const ringsAcross = 28
// Where the pattern is dark it still lets this much through, so the spot reads as one pool
const leak = 0.15

// A gobo for a coloured spot: spokes turning round its middle, broken into rings, from the light's
// own coordinates of each point it lights, whose x and y run 0 to 1 across its cone. Made once
// for each spot, since a spot's pattern is part of every lit shader and is never swapped
function gobo(spin: number) {
  return Fn(([coord]: [Node<'vec3'>]) => {
    const fromMiddle = coord.xy.sub(0.5)
    const turn = atan(fromMiddle.y, fromMiddle.x).add(time.mul(spin))
    const spoke = sin(turn.mul(spokes)).mul(0.5).add(0.5)
    const ring = sin(length(fromMiddle).mul(ringsAcross)).mul(0.5).add(0.5)
    const lit = smoothstep(0.25, 0.6, spoke.mul(ring))
    return vec3(lit.mul(1 - leak).add(leak))
  })
}
const gobos = colourSpots.map(({ spin }) => gobo(spin))

// Where the crates stand, on x and z
type Places = [number, number][]

// The studio's lights: a faint fill and the key light always, and, with the Spotlights switch, a
// spot on each crate and the two coloured ones. A light added or taken away recompiles the lit
// shaders once
export function StudioLights({ crates }: { crates: Places }) {
  const get = useThree((s) => s.get)
  const spotlightsOn = useEffects((s) => s.spotlights)
  const shadowSize = useEffects((s) => s.shadowSize)

  // Made afresh for a new size of shadow map rather than resized: the renderer would resize the
  // map in place, but a way of drawing the stage it has drawn before, such as without the render
  // pipeline, keeps using the map it had, which a resize destroys. A new light compiles the lit
  // shaders afresh, once
  useLayoutEffect(() => {
    const { scene } = get()
    const fill = new HemisphereLight(fillSky, fillGround, fillIntensity)

    const light = new SpotLight(key.colour, key.intensity, 0, key.angle, key.penumbra)
    light.position.set(...key.position)
    light.target.position.set(...key.target)
    light.castShadow = true
    light.shadow.mapSize.set(shadowSize, shadowSize)
    light.shadow.camera.near = keyShadowNear
    light.shadow.camera.far = keyShadowFar
    light.shadow.bias = keyShadowBias
    light.shadow.normalBias = keyShadowNormalBias

    scene.add(fill, light, light.target)
    return () => {
      scene.remove(fill, light, light.target)
      fill.dispose()
      light.dispose()
    }
  }, [get, shadowSize])

  useLayoutEffect(() => {
    if (!spotlightsOn) return undefined
    const { scene } = get()
    const spots: SpotLight[] = []
    for (const [x, z] of crates) {
      const { colour, intensity, height, angle, penumbra } = crateSpot
      const spot = new SpotLight(colour, intensity, 0, angle, penumbra)
      spot.position.set(x, height, z)
      spot.target.position.set(x, 0, z)
      spots.push(spot)
    }
    colourSpots.forEach(({ colour, position, target }, index) => {
      const spot = new SpotLight(colour, colourSpotIntensity)
      spot.angle = colourSpotAngle
      spot.penumbra = colourSpotPenumbra
      // Set before the light is first drawn, and kept for its life
      spot.colorNode = gobos[index]
      spot.position.set(...position)
      spot.target.position.set(...target)
      spots.push(spot)
    })
    for (const spot of spots) scene.add(spot, spot.target)
    return () => {
      for (const spot of spots) {
        scene.remove(spot, spot.target)
        spot.dispose()
      }
    }
  }, [get, crates, spotlightsOn])

  return null
}
