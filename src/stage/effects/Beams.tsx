import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  Data3DTexture,
  FrontSide,
  LinearFilter,
  Mesh,
  RedFormat,
  RepeatWrapping,
  Vector3,
  type SpotLight,
} from 'three'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'
import { bayer16 } from 'three/addons/tsl/math/Bayer.js'
import {
  Fn,
  abs,
  dot,
  mix,
  normalView,
  positionLocal,
  positionViewDirection,
  screenCoordinate,
  smoothstep,
  texture3D,
  time,
  uniform,
  vec3,
} from 'three/tsl'
import { MeshLambertNodeMaterial, VolumeNodeMaterial, type Node } from 'three/webgpu'
import { useEffects } from '../effects.ts'
import { lightRig, type RigLight } from '../studio/lightRig.ts'
import { beamLayer, useBeamVolume } from './beamVolume.ts'

// The cheap beams: a cone under each spot, round its edge in this many sides, as bright at its
// core near the light as this, laid over the picture
const coneSides = 32
const coneGlow = 0.2
// The cone fades in over this much of its length from the light, so it has no hard point, and out
// toward the floor at this power of the distance left
const coneFadeIn = 0.08
const coneFadeOut = 1.5
// The cone thins toward its silhouette at this power of how squarely it faces the camera
const coneEdge = 2

// A cone under each of the crates' spots and the two coloured ones
const coneCount = 5
const down = new Vector3(0, -1, 0)

// The spot drawing a cone, in the crates' order and then the coloured spots', while it's lit
function spotFor(index: number): RigLight<SpotLight> | undefined {
  const { crateSpots, colourSpots } = lightRig
  return index < crateSpots.length
    ? crateSpots[index]
    : colourSpots[index - crateSpots.length]
}

interface Cone {
  mesh: Mesh
  // The cone's colour, its spot's own times how bright the spot is against its rest, so the cone
  // brightens, flashes and dims with it
  colour: { value: Color }
}

// The cheap beams: a soft cone of light under each spot, drawn in one pass with the stage, unlit
// and added to what's behind it, emitting so the bloom softens it. Each follows its spot every
// frame, so a sweeping spot's cone sweeps with it and a brightened spot's cone brightens
export function CheapBeams() {
  const get = useThree((s) => s.get)
  const cones = useRef<Cone[]>([])
  const aim = useRef(new Vector3())

  useLayoutEffect(() => {
    const { scene } = get()
    // A cone with its point at the light and its open end a unit below, scaled to each spot's reach
    const geometry = new ConeGeometry(1, 1, coneSides, 1, true)
    geometry.translate(0, -0.5, 0)
    // From 0 at the light to 1 at the floor
    const along = positionLocal.y.negate()
    const facing = abs(dot(normalView, positionViewDirection))
    // Only the near side is drawn, which covers the cone's whole outline once: the far side would
    // double the pixels the cone costs for a little more brightness, which the glow gives instead
    const fade = smoothstep(0, coneFadeIn, along)
      .mul(along.oneMinus().pow(coneFadeOut))
      .mul(facing.pow(coneEdge))
      .mul(coneGlow)
    const made: Cone[] = []
    for (let index = 0; index < coneCount; index++) {
      const colour = uniform(new Color())
      // Black and unlit but for what it gives off, through which the haze and the fog don't draw
      const material = new MeshLambertNodeMaterial({
        color: 0x000000,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: FrontSide,
      })
      material.lights = false
      material.fog = false
      material.emissiveNode = colour
      material.opacityNode = fade
      const mesh = new Mesh(geometry, material)
      // Light, not a thing: it takes no presses and casts no shadow
      mesh.raycast = () => undefined
      mesh.visible = false
      scene.add(mesh)
      made.push({ mesh, colour })
    }
    cones.current = made
    return () => {
      cones.current = []
      for (const { mesh } of made) {
        scene.remove(mesh)
        if (mesh.material instanceof MeshLambertNodeMaterial) mesh.material.dispose()
      }
      geometry.dispose()
    }
  }, [get])

  useFrame(() => {
    const toward = aim.current
    const shown = cones.current
    for (let index = 0; index < shown.length; index++) {
      const { mesh, colour } = shown[index]
      const spot = spotFor(index)
      mesh.visible = spot !== undefined
      if (!spot) continue
      const { light, rest } = spot
      toward.subVectors(light.target.position, light.position)
      const reach = toward.length()
      const radius = reach * Math.tan(light.angle)
      mesh.position.copy(light.position)
      mesh.quaternion.setFromUnitVectors(down, toward.divideScalar(reach))
      mesh.scale.set(radius, reach, radius)
      colour.value.copy(light.color).multiplyScalar(light.intensity / rest)
    }
  })

  return null
}

// The light beams' haze fills a box over the stage, from the floor up past the spots
const hazeSize = [9, 5, 5.5] as const
const hazePlace = [0, 2.5, -0.25] as const
// Its grain: a tiling noise this many texels a side, this many cycles across, sampled at three
// scales, each in cycles of the texture per unit of the stage, drifting this fast
const grainTexels = 64
const grainCycles = 16
const grainScales = [0.1, 0.05, 0.02] as const
const grainDrift = 0.3
// How far the grain thins and thickens the haze, from none at 0 to the noise's full range at 1
// and more beyond it
const grainAmount = 1.6

// The haze's noise, worked out once for the page, since it takes a moment and never changes
let grain: Uint8Array | null = null
function grainData(): Uint8Array {
  if (grain) return grain
  const noise = new ImprovedNoise()
  const data = new Uint8Array(grainTexels ** 3)
  const step = grainCycles / grainTexels
  let i = 0
  for (let z = 0; z < grainTexels; z++) {
    for (let y = 0; y < grainTexels; y++) {
      for (let x = 0; x < grainTexels; x++) {
        data[i++] = 128 + 127 * noise.noise(x * step, y * step, z * step)
      }
    }
  }
  grain = data
  return data
}

// The light beams, after three's volumetric lighting example: a box of drifting haze over the
// stage on a layer of its own, which the spots on that layer light and shadow as they shine
// through it, marched in steps from each pixel. The render pipeline draws it in a small pass of
// its own, blurs it and lays it over the picture, so this makes the haze and hands it over
export function LightBeams() {
  const get = useThree((s) => s.get)

  useLayoutEffect(() => {
    const { scene } = get()
    const noise = new Data3DTexture(grainData(), grainTexels, grainTexels, grainTexels)
    noise.format = RedFormat
    noise.minFilter = LinearFilter
    noise.magFilter = LinearFilter
    noise.wrapS = RepeatWrapping
    noise.wrapT = RepeatWrapping
    noise.unpackAlignment = 1
    noise.needsUpdate = true

    const material = new VolumeNodeMaterial()
    material.steps = useEffects.getState().beamSteps
    // Each pixel starts its steps a little further along than its neighbours, so the steps' bands
    // break up into a fine grain the blur then smooths
    material.offsetNode = bayer16(screenCoordinate)
    // The haze is light added over the picture; the studio's low haze is already in the picture
    material.fog = false
    const drift = vec3(time, 0, time.mul(0.3)).mul(grainDrift)
    material.scatteringNode = Fn(({ positionRay }: { positionRay: Node<'vec3'> }) => {
      const sample = (scale: number, speed: number) =>
        texture3D(noise, positionRay.add(drift.mul(speed)).mul(scale).mod(1), 0).r.add(0.5)
      const density = sample(grainScales[0], 1)
        .mul(sample(grainScales[1], 1))
        .mul(sample(grainScales[2], 2))
      return mix(1, density, grainAmount)
    })

    const geometry = new BoxGeometry(...hazeSize)
    const box = new Mesh(geometry, material)
    box.position.set(...hazePlace)
    box.layers.set(beamLayer)
    // The spots' shadows reach into the haze, so the crates and the host cut the beams
    box.receiveShadow = true
    box.raycast = () => undefined
    scene.add(box)
    useBeamVolume.setState({ material })

    const unsubscribe = useEffects.subscribe(({ beamSteps }) => {
      material.steps = beamSteps
    })
    return () => {
      unsubscribe()
      useBeamVolume.setState({ material: null })
      scene.remove(box)
      geometry.dispose()
      material.dispose()
      noise.dispose()
    }
  }, [get])

  return null
}
