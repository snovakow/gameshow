import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { AdditiveBlending, Sprite, Vector2, Vector3 } from 'three'
import {
  Fn,
  If,
  TWO_PI,
  color,
  cos,
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  select,
  sin,
  smoothstep,
  sqrt,
  uint,
  uniform,
  uv,
  vec3,
  vec4,
} from 'three/tsl'
import { SpriteNodeMaterial, WebGPURenderer, type ComputeNode, type Node } from 'three/webgpu'
import { useEffects } from '../effects.ts'
import { places, type HostMode } from '../layout.ts'
import { useCelebrationCues } from './useCelebrationCues.ts'

// The finale's display: this many shells, one after another, each bursting into this many sparks
const shells = 12
const sparksPerShell = 250
const sparks = shells * sparksPerShell
// The first shell bursts this soon after the finale starts, the rest this far apart, each up to
// this much late, so they don't keep time like a clock
const firstShell = 0.2
const shellInterval = 0.55
const shellJitter = 0.3
// Where the shells burst: over the back of the stage, this wide and this tall, behind the host and
// in front of the marquee, as deep and as high as her place gives (layout.ts)
const burstHalfWidth = 2.6
const burstHeight = 0.6
// How fast a shell's sparks fly out, and how much faster for a bigger shell
const speedLeast = 1.8
const speedRange = 0.6
// The sparks drift down a little and slow as they spread, as embers do
const sparkGravity = 1.2
const sparkDrag = 0.9
// How long a spark burns, and its size at its brightest, in metres
const lifeLeast = 1.5
const lifeRange = 0.7
const sparkSize = 0.08
// The last spark has gone out by then
const displayTime = firstShell + (shells - 1) * shellInterval + shellJitter + lifeLeast + lifeRange
// The shells' colours, at their brightest; each spark starts white-hot and cools into its shell's
const palette = [0xffc04a, 0xff4a3a, 0x5cff78, 0x5c9cff, 0xff66d9, 0xe8ecff]
// How many stretches of the hash's inputs each display takes, and where the shells' own begin
// within it, past every spark's
const generationStride = 8
const shellStretch = 6 * sparks
// A frame longer than this, as when the tab was hidden, moves the sparks no further
const longestStep = 0.1

// The burst box's lowest height, nearest depth and depth back from there, for a place of the
// host's, as the uniform holds them
function regionFor(host: HostMode) {
  const { low, near, depth } = places[host].fireworks
  return new Vector3(low, near, depth)
}

// Fireworks over the stage at the finale, after webgpu_compute_particles: every spark's place and
// speed live on the GPU, moved each frame by one compute pass and drawn as one sprite repeated for
// every spark. They shine, so the bloom lights them
export function Fireworks() {
  const get = useThree((s) => s.get)
  const parts = useRef<{
    renderer: WebGPURenderer
    sprite: Sprite
    // What a frame computes, made once, since the renderer would make a list of a single node
    updates: ComputeNode[]
    // The effect's clock and the step it last moved by, written in place each frame
    timing: { value: Vector2 }
    generation: { value: number }
    start: { value: number }
  } | null>(null)
  // The display's own clock, which runs only while it plays and never jumps by more than a short
  // step, so a stall never cuts it short
  const clock = useRef({ time: 0, until: 0, warm: false })
  const pending = useRef(false)

  useLayoutEffect(() => {
    const { gl, scene } = get()
    if (!(gl instanceof WebGPURenderer)) return undefined

    // One uniform for both, whose numbers are written in place: a number set on a uniform of its
    // own would be boxed anew every frame
    const timing = uniform(new Vector2())
    const now = timing.x
    const step = timing.y
    // Each finale is a new generation; the buffers start at 0, so every spark is hidden before one
    const generation = uniform(-1)
    const start = uniform(0)
    // The burst box's lowest height, nearest depth and depth, for the host's place now
    const region = uniform(regionFor(useEffects.getState().host))
    const unsubscribe = useEffects.subscribe(({ host }, previous) => {
      if (host !== previous.host) region.value.copy(regionFor(host))
    })

    // Four numbers a spark in every buffer, read and written whole: a 2014 Intel Mac's Metal
    // compiler fails on a compute pass that writes single fields of three-number elements
    const positions = instancedArray(sparks, 'vec4')
    const velocities = instancedArray(sparks, 'vec4')
    // When the spark is born, its generation, how long it burns, and its shell's colour
    const states = instancedArray(sparks, 'vec4')

    const shellIndex = instanceIndex.div(sparksPerShell)
    const shell = float(shellIndex)
    // Random numbers new for each display, each spark's own or the same for every spark of a
    // shell, each from its own stretch of the hash's inputs, in whole numbers, which wrap rather
    // than lose precision however many displays there are
    const display = uint(generation.add(1)).mul(generationStride * sparks)
    const ofSpark = (salt: number) => hash(instanceIndex.add(display).add(salt * sparks))
    const ofShell = (salt: number) =>
      hash(shellIndex.add(display).add(shellStretch).add(salt * shells))

    const update = Fn(() => {
      const position = positions.element(instanceIndex).xyz.toVar()
      const velocity = velocities.element(instanceIndex).xyz.toVar()
      const state = states.element(instanceIndex).toVar()

      If(state.y.notEqual(generation), () => {
        position.assign(
          vec3(
            ofShell(1).mul(2).sub(1).mul(burstHalfWidth),
            ofShell(2).mul(burstHeight).add(region.x),
            ofShell(3).mul(region.z).negate().add(region.y),
          ),
        )
        // Evenly over a sphere, a little faster or slower each
        const up = ofSpark(1).mul(2).sub(1)
        const around = ofSpark(2).mul(TWO_PI)
        const flat = sqrt(up.mul(up).oneMinus())
        const speed = ofShell(4)
          .mul(speedRange)
          .add(speedLeast)
          .mul(ofSpark(3).mul(0.1).add(0.9))
        velocity.assign(vec3(flat.mul(cos(around)), up, flat.mul(sin(around))).mul(speed))
        const born = start.add(shell.mul(shellInterval)).add(ofShell(5).mul(shellJitter))
        const life = ofSpark(4).mul(lifeRange).add(lifeLeast)
        state.assign(vec4(born, generation, life, ofShell(6)))
      }).ElseIf(now.greaterThanEqual(state.x).and(now.lessThan(state.x.add(state.z))), () => {
        velocity.assign(
          velocity.sub(vec3(0, step.mul(sparkGravity), 0)).mul(float(1).sub(step.mul(sparkDrag))),
        )
        position.assign(position.add(velocity.mul(step)))
      })

      positions.element(instanceIndex).assign(vec4(position, 0))
      velocities.element(instanceIndex).assign(vec4(velocity, 0))
      states.element(instanceIndex).assign(state)
    })().compute(sparks)

    // Each spark where the compute pass left it, from its burst until it burns out, white-hot at
    // first, then its shell's colour, fading and flickering as it dies
    const state = states.toAttribute()
    const age = now.sub(state.x)
    const burnt = age.div(state.z)
    const burning = state.y
      .equal(generation)
      .and(age.greaterThanEqual(0))
      .and(burnt.lessThan(1))
    const fade = burnt.oneMinus().max(0).pow(1.5)
    const flicker = mix(
      float(1),
      sin(age.mul(30).add(hash(instanceIndex).mul(TWO_PI))).mul(0.4).add(0.6),
      smoothstep(0.4, 0.8, burnt),
    )
    const pick = state.w.mul(palette.length).floor()
    let shellColour: Node<'color'> = color(palette[0])
    for (let i = 1; i < palette.length; i++) {
      shellColour = select(pick.equal(i), color(palette[i]), shellColour)
    }
    const hue = mix(vec3(1), shellColour, smoothstep(0, 0.3, age))
    // A soft round glow, brightest in the middle
    const glow = uv().sub(0.5).length().mul(2).oneMinus().max(0).pow(2)

    const material = new SpriteNodeMaterial()
    material.positionNode = positions.toAttribute().xyz
    material.scaleNode = select(burning, fade.mul(0.6).add(0.4).mul(sparkSize), float(0))
    material.colorNode = vec4(0, 0, 0, glow)
    material.emissiveNode = hue.mul(fade).mul(flicker)
    material.blending = AdditiveBlending
    material.depthWrite = false
    // Lights in the sky, which the studio's haze and the daylight's fog don't dim
    material.fog = false
    const sprite = new Sprite(material)
    sprite.count = sparks
    // The sparks are placed by the GPU, far from the sprite's own place
    sprite.frustumCulled = false
    // Decoration: it takes no presses
    sprite.raycast = () => undefined
    scene.add(sprite)
    // Run and drawn once now, every spark hidden, so the shaders are ready before the finale
    void gl.compute(update)
    clock.current = { time: 0, until: 0, warm: true }

    parts.current = { renderer: gl, sprite, updates: [update], timing, generation, start }
    return () => {
      unsubscribe()
      parts.current = null
      scene.remove(sprite)
      // Every sprite shares three's one quad, which stays
      material.dispose()
      update.dispose()
      for (const buffer of [positions, velocities, states]) buffer.value.dispose()
    }
  }, [get])

  useCelebrationCues({
    onCue: (name) => {
      if (name === 'finale') pending.current = true
    },
    onReset: () => {
      pending.current = false
      clock.current.until = 0
      if (parts.current) parts.current.sprite.visible = false
    },
  })

  useFrame((_, delta) => {
    const made = parts.current
    if (!made) return
    const c = clock.current
    if (pending.current) {
      pending.current = false
      made.generation.value += 1
      made.start.value = c.time + firstShell
      c.until = c.time + displayTime
      c.warm = false
      made.sprite.visible = true
    }
    if (!made.sprite.visible) return
    // The frame that draws it once, hidden, to make its shaders
    if (c.warm) {
      c.warm = false
      return
    }
    if (c.time >= c.until) {
      made.sprite.visible = false
      return
    }
    const step = Math.min(delta, longestStep)
    c.time += step
    made.timing.value.set(c.time, step)
    void made.renderer.compute(made.updates)
  })

  return null
}
