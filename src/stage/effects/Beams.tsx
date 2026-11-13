import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
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
  cameraNear,
  cameraPosition,
  dot,
  float,
  length,
  max,
  min,
  mix,
  modelNormalMatrix,
  modelWorldMatrixInverse,
  normalView,
  positionLocal,
  positionView,
  positionViewDirection,
  positionWorld,
  saturate,
  screenCoordinate,
  select,
  smoothstep,
  sqrt,
  texture3D,
  time,
  uniform,
  vec3,
  vec4,
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

// Within this far of a cone's surface, or inside it, the camera sees the cone from within: its near
// side would be cut by the view's near plane and, once inside, there is no near side to draw. So
// the cone is drawn by its far side instead, shaded as its near side would be. This far is the
// near plane's depth over the cosine of a view's corner, about 40° off its middle, and nearer
// than any opening view stands to a cone, so the stage opens on the cones as they always were
const insideMargin = 0.33
// From within, the far side's glow fades out over this much of the view's depth past the near
// plane, so the cone fades as the camera nears the side it is about to pass out through, rather
// than being cut
const nearFadeDepth = 0.35
// A ray whose way into the cone lies within this of its way out passes through none of it
const passTolerance = 0.02
// For its first frames each cone's inside is drawn shrunk to its point, where it covers no pixel,
// so its shader is built as the cones appear rather than when the camera first enters one, where
// the building would hold the picture still for half a second on a slow device
const warmUpFrames = 2

// The spot drawing a cone, in the crates' order and then the coloured spots', while it's lit
function spotFor(index: number): RigLight<SpotLight> | undefined {
  const { crateSpots, colourSpots } = lightRig
  return index < crateSpots.length
    ? crateSpots[index]
    : colourSpots[index - crateSpots.length]
}

interface Cone {
  // The cone seen from outside, by its near side
  mesh: Mesh
  // The same cone seen from within, by its far side and its closed end
  within: Mesh
  // The cone's colour, its spot's own times how bright the spot is against its rest, so the cone
  // brightens, flashes and dims with it
  colour: { value: Color }
}

// How brightly the cone glows where a ray enters it, from how far down the cone that is (0 at the
// light, 1 at its end) and how squarely the ray meets the cone's surface there
function glowAt(along: Node<'float'>, facing: Node<'float'>) {
  return smoothstep(0, coneFadeIn, along)
    .mul(along.oneMinus().pow(coneFadeOut))
    .mul(facing.pow(coneEdge))
    .mul(coneGlow)
}

// The glow of the cone seen from within, drawn on its far side and closed end: each pixel's ray is
// followed back to where it enters the cone, before the camera when it's outside and behind it when
// it's inside, and shaded as the near side would be there, so the glow is the same either side of
// the surface. In the cone's own space it is x² + z² = y², below the light at y = 0
function withinGlow() {
  const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  // From the camera at 0 to this pixel at 1
  const ray = positionLocal.sub(eye)
  const a = ray.x.mul(ray.x).add(ray.z.mul(ray.z)).sub(ray.y.mul(ray.y))
  const halfB = eye.x.mul(ray.x).add(eye.z.mul(ray.z)).sub(eye.y.mul(ray.y))
  const c = eye.x.mul(eye.x).add(eye.z.mul(eye.z)).sub(eye.y.mul(eye.y))
  const root = sqrt(max(halfB.mul(halfB).sub(a.mul(c)), 0))
  // A ray along the cone's own slope meets it once; nudged off it, it meets it twice, far off
  const safeA = a.add(select(a.lessThan(0), float(-1e-6), float(1e-6)))
  const first = halfB.negate().sub(root).div(safeA)
  const second = halfB.negate().add(root).div(safeA)
  const near = min(first, second)
  const far = max(first, second)
  // Below the light, on the cone itself rather than its mirror above the light
  const onCone = (at: Node<'float'>) => eye.y.add(ray.y.mul(at)).lessThanEqual(0)
  const entry = select(onCone(near), near, far)
  const span = length(positionWorld.sub(cameraPosition))
  // A ray that meets the cone only where it leaves came in through its open end, where nothing
  // is drawn from outside either
  const enters = onCone(entry).and(entry.oneMinus().mul(span).greaterThan(passTolerance))
  const point = eye.add(ray.mul(entry))
  const along = saturate(point.y.negate())
  // The surface's outward normal there, in the stage's space, to meet the ray as the near side does
  const normal = modelNormalMatrix.mul(vec3(point.x, along, point.z)).normalize()
  const facing = abs(dot(normal, positionWorld.sub(cameraPosition).normalize()))
  const nearFade = smoothstep(cameraNear, cameraNear.add(nearFadeDepth), positionView.z.negate())
  return select(enters, glowAt(along, facing).mul(nearFade), float(0))
}

// Stands a cone at its spot, pointing the way it shines, as wide and as long as its light reaches
function fitCone(cone: Mesh, light: SpotLight, toward: Vector3, radius: number, reach: number) {
  cone.position.copy(light.position)
  cone.quaternion.setFromUnitVectors(down, toward)
  cone.scale.set(radius, reach, radius)
}

// The cheap beams: a soft cone of light under each spot, drawn in one pass with the stage, unlit
// and added to what's behind it, emitting so the bloom softens it. Each follows its spot every
// frame, so a sweeping spot's cone sweeps with it and a brightened spot's cone brightens
export function CheapBeams() {
  const get = useThree((s) => s.get)
  const cones = useRef<Cone[]>([])
  const aim = useRef(new Vector3())
  const fromLight = useRef(new Vector3())
  const framesDrawn = useRef(0)

  useLayoutEffect(() => {
    const { scene } = get()
    // A cone with its point at the light and its open end a unit below, scaled to each spot's reach
    const geometry = new ConeGeometry(1, 1, coneSides, 1, true)
    geometry.translate(0, -0.5, 0)
    // From within, the closed end is drawn too, for the rays that leave through it
    const closed = new ConeGeometry(1, 1, coneSides, 1, false)
    closed.translate(0, -0.5, 0)
    // From 0 at the light to 1 at the floor
    const along = positionLocal.y.negate()
    const facing = abs(dot(normalView, positionViewDirection))
    // Only the near side is drawn, which covers the cone's whole outline once: the far side would
    // double the pixels the cone costs for a little more brightness, which the glow gives instead
    const fade = glowAt(along, facing)
    const fadeWithin = withinGlow()
    // Black and unlit but for what it gives off, through which the haze and the fog don't draw
    const glowing = (colour: Node<'color'>, opacity: Node<'float'>, within: boolean) => {
      const material = new MeshLambertNodeMaterial({
        color: 0x000000,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: within ? BackSide : FrontSide,
        // From within, whatever stands in the cone is inside it, as the crate under its spot is,
        // and from outside the cone's near side draws over it, so from within nothing hides the
        // glow
        depthTest: !within,
      })
      material.lights = false
      material.fog = false
      material.emissiveNode = colour
      material.opacityNode = opacity
      return material
    }
    const made: Cone[] = []
    for (let index = 0; index < coneCount; index++) {
      const colour = uniform(new Color())
      const mesh = new Mesh(geometry, glowing(colour, fade, false))
      const within = new Mesh(closed, glowing(colour, fadeWithin, true))
      // Drawn only with the camera in it or beside it, and shrunk to its point while warming up,
      // where the light may stand out of view, so it is never left out for being out of view
      within.frustumCulled = false
      for (const cone of [mesh, within]) {
        // Light, not a thing: it takes no presses and casts no shadow
        cone.raycast = () => undefined
        cone.visible = false
        scene.add(cone)
      }
      made.push({ mesh, within, colour })
    }
    cones.current = made
    framesDrawn.current = 0
    return () => {
      cones.current = []
      for (const { mesh, within } of made) {
        for (const cone of [mesh, within]) {
          scene.remove(cone)
          if (cone.material instanceof MeshLambertNodeMaterial) cone.material.dispose()
        }
      }
      geometry.dispose()
      closed.dispose()
    }
  }, [get])

  useFrame(({ camera }) => {
    const toward = aim.current
    const eye = fromLight.current
    const shown = cones.current
    const warming = framesDrawn.current < warmUpFrames
    framesDrawn.current++
    for (let index = 0; index < shown.length; index++) {
      const { mesh, within, colour } = shown[index]
      const spot = spotFor(index)
      if (!spot) {
        mesh.visible = false
        within.visible = false
        continue
      }
      const { light, rest } = spot
      toward.subVectors(light.target.position, light.position)
      const reach = toward.length()
      const radius = reach * Math.tan(light.angle)
      toward.divideScalar(reach)
      // How far the camera is outside the cone's surface, along its slope, and how far down the
      // cone it stands
      eye.subVectors(camera.position, light.position)
      const depth = eye.dot(toward)
      const across = eye.addScaledVector(toward, -depth).length()
      const outside = across * Math.cos(light.angle) - depth * Math.sin(light.angle)
      const fromWithin =
        outside < insideMargin && depth > -insideMargin && depth < reach + insideMargin
      fitCone(mesh, light, toward, radius, reach)
      fitCone(within, light, toward, radius, reach)
      mesh.visible = !fromWithin
      within.visible = fromWithin || warming
      if (warming && !fromWithin) within.scale.setScalar(0)
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
    // The spots' shadows reach into the haze, so the crates cut the beams of the spots over them
    // and the podium, or the host standing on the floor, casts the coloured spots' shadows
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
