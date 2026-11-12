import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { CanvasTexture, DoubleSide, SRGBColorSpace, Sprite, TextureLoader, type Texture } from 'three'
import {
  Fn,
  TWO_PI,
  billboarding,
  mix,
  oneMinus,
  sin,
  spherizeUV,
  step,
  texture,
  time,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { SpriteNodeMaterial } from 'three/webgpu'
import { useCelebrationCues } from './useCelebrationCues.ts'

const noises = `${import.meta.env.BASE_URL}textures/noises/`
const cellularUrl = `${noises}voronoi/grayscale-256x256.png`
const perlinUrl = `${noises}perlin/rgb-256x256.png`

// A jet at each side of the stage, beyond the outer crates and their rings, a little behind them
const jets = [-2.45, 2.45]
const jetDepth = -0.35
// Each jet is a broad flame round a narrower, white-hot core, in metres at full height
const flameSize = { width: 1, height: 1.5 }
const coreSize = { width: 0.9, height: 1.25 }
// The fire's colours from its cool edge to its hottest middle, drawn into a strip at runtime
const fireColours = ['#1c0600', '#8a1800', '#ff5a00', '#ffb040', '#fff4dc']
const gradientWidth = 128
// The part of the fire's colour that also feeds the glow round it, so it blooms without washing out
const glowShare = 0.6
// A win's jets roar up, burn while the host dances, and die down, in seconds from the cue
const roarUp = 0.25
const burnUntil = 3.5
const dieDown = 0.8
// A jet starts this short and narrow and grows to its full size as it roars up
const leastHeight = 0.2
const leastWidth = 0.7

// Small enough to draw nothing, so a hidden first frame still makes the shaders
const unseen = 1e-4

// Sizes a pair of jets for how strongly they burn, from nothing to their full height, standing
// on the floor as they grow
function standJets(
  sprites: Sprite[],
  size: { width: number; height: number },
  shown: boolean,
  strength: number,
) {
  const tall = size.height * (leastHeight + (1 - leastHeight) * strength) * strength
  const wide = size.width * (leastWidth + (1 - leastWidth) * strength)
  // Counted rather than iterated, which would make an iterator every frame
  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i]
    sprite.visible = shown
    sprite.scale.set(wide, tall, 1)
    // Its middle half its height up
    sprite.position.y = tall / 2
  }
}

// The broad flame of webgpu_tsl_vfx_flames: a teardrop rippling upward, eaten into by cellular
// noise drifting up through it, coloured from the strip by how far inside the flame each point is
function broadFlame(cellular: Texture, gradient: Texture) {
  return Fn(() => {
    const mainUv = uv().toVar()
    mainUv.assign(spherizeUV(mainUv, 10).mul(0.6).add(0.2))
    mainUv.assign(mainUv.pow(vec2(1, 2)))
    mainUv.assign(mainUv.mul(vec2(2, 1)).sub(vec2(0.5, 0)))

    const ripple = sin(time.mul(10).sub(mainUv.y.mul(TWO_PI).mul(2))).toVar()
    const upward = mainUv.y.smoothstep(0, 1).toVar()
    mainUv.x.addAssign(ripple.mul(upward).mul(0.2))

    const cellularUv = mainUv.mul(0.5).add(vec2(0, time.negate().mul(0.5))).mod(1)
    const cellularNoise = texture(cellular, cellularUv, 0)
      .r.oneMinus()
      .smoothstep(0, 0.5)
      .oneMinus()
      .mul(upward)

    const shape = mainUv.sub(0.5).mul(vec2(3, 2)).length().oneMinus().sub(cellularNoise).toVar()
    const fire = texture(gradient, vec2(shape, 0))
    const colour = mix(fire.rgb, vec3(1), shape.step(0.8))
    return vec4(colour, shape.smoothstep(0, 0.3))
  })()
}

// The white-hot core of the same example: thin licks of flame, bent by layers of drifting perlin
// noise and broken up by cellular noise, fading toward the top
function coreFlame(cellular: Texture, perlin: Texture) {
  return Fn(() => {
    const mainUv = uv().toVar()
    mainUv.assign(spherizeUV(mainUv, 10).mul(0.6).add(0.2))
    mainUv.assign(mainUv.abs().pow(vec2(1, 3)).mul(mainUv.sign()))
    mainUv.assign(mainUv.mul(vec2(2, 1)).sub(vec2(0.5, 0)))

    const perlinUv = mainUv.add(vec2(0, time.negate())).mod(1)
    const perlinNoise = texture(perlin, perlinUv, 0).sub(0.5)
    mainUv.x.addAssign(perlinNoise.x.mul(0.5))

    const ripple = sin(time.mul(10).sub(mainUv.y.mul(TWO_PI).mul(2)))
    const upward = mainUv.y.smoothstep(0, 1)
    const fading = oneMinus(mainUv.y).smoothstep(0, 0.3)
    mainUv.x.addAssign(ripple.mul(upward).mul(0.2))

    const warpUv = mainUv.mul(0.5).add(vec2(0, time.negate().mul(0.25))).mod(1)
    const warp = texture(perlin, warpUv, 0).sub(0.5)
    const warpedUv = mainUv.add(vec2(0, time.negate().mul(0.5))).add(warp.xy).mod(1)
    const warped = texture(perlin, warpedUv, 0).sub(0.5)
    mainUv.x.addAssign(warped.x.mul(0.5))

    const cellularUv = mainUv.add(vec2(0, time.negate().mul(1.5))).mod(1)
    const cellularNoise = texture(cellular, cellularUv, 0).r.oneMinus().smoothstep(0.25, 1)

    const shape = step(mainUv.sub(0.5).mul(vec2(6, 1)).length(), 0.5)
      .mul(cellularNoise)
      .mul(fading)
    return vec4(vec3(1), step(0.01, shape))
  })()
}

// A flame's material: billboarded so it always faces the camera while staying upright, giving off
// what it draws, part of it to the glow
function flameMaterial(flame: ReturnType<typeof broadFlame>) {
  const material = new SpriteNodeMaterial({ side: DoubleSide })
  material.colorNode = vec4(flame.rgb.mul(1 - glowShare), flame.a)
  material.emissiveNode = flame.rgb.mul(glowShare)
  material.vertexNode = billboarding({ horizontalRotation: true })
  // Fire is a light of its own, which the studio's haze and the daylight's fog don't dim
  material.fog = false
  material.depthWrite = false
  return material
}

// Jets of flame at the stage's sides while a win is celebrated, after webgpu_tsl_vfx_flames: each
// a pair of sprites whose fire is drawn entirely on the GPU from two noise textures and a strip of
// colour, so a frame's only work on the CPU is each jet's height
export function Flames() {
  const get = useThree((s) => s.get)
  const [cellular, perlin] = useLoader(TextureLoader, [cellularUrl, perlinUrl])
  const sprites = useRef<{ flames: Sprite[]; cores: Sprite[] } | null>(null)
  // When the current win's jets started, on the stage's clock, and whether a cue waits to start them
  const burning = useRef({ since: Number.NEGATIVE_INFINITY, pending: false, warm: false })

  useLayoutEffect(() => {
    const { scene } = get()
    const strip = document.createElement('canvas')
    strip.width = gradientWidth
    strip.height = 1
    const context = strip.getContext('2d')
    if (context) {
      const fill = context.createLinearGradient(0, 0, gradientWidth, 0)
      fireColours.forEach((colour, i) => fill.addColorStop(i / (fireColours.length - 1), colour))
      context.fillStyle = fill
      context.fillRect(0, 0, gradientWidth, 1)
    }
    const gradient = new CanvasTexture(strip)
    gradient.colorSpace = SRGBColorSpace

    const flameMade = flameMaterial(broadFlame(cellular, gradient))
    const coreMade = flameMaterial(coreFlame(cellular, perlin))
    const make = (material: SpriteNodeMaterial, x: number, order: number) => {
      const sprite = new Sprite(material)
      sprite.position.set(x, 0, jetDepth)
      // The core draws over its flame
      sprite.renderOrder = order
      sprite.visible = false
      // Decoration: it takes no presses
      sprite.raycast = () => undefined
      scene.add(sprite)
      return sprite
    }
    const flames = jets.map((x) => make(flameMade, x, 1))
    const cores = jets.map((x) => make(coreMade, x, 2))
    sprites.current = { flames, cores }
    // Drawn once now, at no size, so the shaders are ready before the first win
    burning.current = { since: Number.NEGATIVE_INFINITY, pending: false, warm: true }

    return () => {
      sprites.current = null
      for (const sprite of [...flames, ...cores]) scene.remove(sprite)
      // Every sprite shares three's one quad, which stays; the noise textures are the loader's
      flameMade.dispose()
      coreMade.dispose()
      gradient.dispose()
    }
  }, [get, cellular, perlin])

  useCelebrationCues({
    onCue: (name) => {
      if (name === 'win') burning.current.pending = true
    },
    onReset: () => {
      burning.current.pending = false
      burning.current.since = Number.NEGATIVE_INFINITY
    },
  })

  useFrame(({ clock }) => {
    const made = sprites.current
    if (!made) return
    const b = burning.current
    const now = clock.elapsedTime
    if (b.pending) {
      b.pending = false
      b.since = now
    }
    const age = now - b.since
    // Up, burning, then down; 0 before and after
    const strength =
      age < 0
        ? 0
        : age < roarUp
          ? age / roarUp
          : age < burnUntil
            ? 1
            : Math.max(0, 1 - (age - burnUntil) / dieDown)
    // The frame that draws them once, too small to see, to make their shaders
    const warming = b.warm && strength === 0
    b.warm = false
    const shown = strength > 0 || warming
    const size = warming ? unseen : strength
    standJets(made.flames, flameSize, shown, size)
    standJets(made.cores, coreSize, shown, size)
  })

  return null
}
