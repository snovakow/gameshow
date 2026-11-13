import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { DoubleSide, Mesh, PlaneGeometry, Vector2, Vector3 } from 'three'
import {
  Fn,
  If,
  PI,
  TWO_PI,
  abs,
  cameraPosition,
  color,
  cos,
  float,
  hash,
  instanceIndex,
  instancedArray,
  max,
  positionLocal,
  rotate,
  select,
  sin,
  smoothstep,
  uint,
  uniform,
  vec2,
  vec3,
  vec4,
  vertexStage,
} from 'three/tsl'
import { MeshBasicNodeMaterial, WebGPURenderer, type ComputeNode, type Node } from 'three/webgpu'
import { mostConfetti, useEffects } from '../effects.ts'
import { places, podium, type HostMode } from '../layout.ts'
import { useCelebrationCues } from './useCelebrationCues.ts'

// A piece of paper, in metres, wide enough to catch the eye on a phone across the stage
const pieceWidth = 0.06
const pieceHeight = 0.034
// The festive colours the pieces are cut from, one in six each
const palette = [0xffd23f, 0xff3b4e, 0x3fa9ff, 0x46e38a, 0xff6fd8, 0xf4f1ea]

// Paper falls slowly: gravity pulls, the air drags at every speed, and each piece falls no faster
// than its own gentle speed, swaying from side to side as it goes
const gravity = 9.8
const drag = 1.6
const fallLeast = 0.7
const fallRange = 0.6
const sway = 0.45
const swayLeast = 1.5
const swayRange = 2.5
// How fast a piece tumbles, in radians a second
const spinLeast = 4
const spinRange = 8

// A burst leaves the winning crate's mouth just after its lid starts to lift, the pieces streaming
// out over half a second, thrown upward and outward
const crateTop = 0.8
const burstDelay = 0.3
const burstStagger = 0.5
const upLeast = 4
const upRange = 3
const outMost = 2.6
// Every piece of a burst has landed by then, even the highest thrown and slowest to fall
// (0.8 s to leave, under 0.8 s to rise to 3.4 m, under 5 s to fall from there)
const burstFlight = 7
// A burst's pieces lie on the floor this long after landing, then shrink away over this long
const burstLinger = 4
const shrinkTime = 0.8

// The finale's shower starts above the view across the whole stage and keeps coming for a few
// seconds; its pieces stay where they land until the show goes back to its title
const showerHalfWidth = 4
const showerBack = -3.5
const showerDepth = 6
const showerLow = 3
const showerHeight = 2.5
const showerSpread = 3.5
// The last piece to set off has landed by then (3.5 s, then under 7.9 s to fall 5.5 m)
const showerFlight = 12
const forever = 1e9

// A piece comes to rest just above the floor, or above the host's podium where it falls on it, each
// at its own height, so none flickers into either
const restLeast = 0.003
const restRange = 0.004
// A frame longer than this, as when the tab was hidden, moves the pieces no further, so a stall
// never throws them through the floor
const longestStep = 0.1

const burst = 0
const shower = 1
// How many stretches of the hash's inputs each generation takes, more than any trait uses
const generationStride = 16

// What a piece over the podium's disc lands on: its top where it stands, the floor where it doesn't
function podiumTopFor(host: HostMode) {
  return places[host].onPodium ? podium.height : 0
}

// Confetti, after webgpu_compute_particles_snow: every piece's place and speed live on the GPU,
// moved each frame by one compute pass and drawn as one instanced mesh, so the CPU does no work
// per piece. A win bursts it from the winning crate; the finale showers it over the stage
export function Confetti({ crates }: { crates: [number, number][] }) {
  const get = useThree((s) => s.get)
  const parts = useRef<{
    renderer: WebGPURenderer
    mesh: Mesh
    update: ComputeNode
    // What a frame computes, made once, since the renderer would make a list of a single node
    updates: ComputeNode[]
    // The effect's clock and the step it last moved by, written in place each frame
    timing: { value: Vector2 }
    generation: { value: number }
    mode: { value: number }
    origin: { value: Vector3 }
    start: { value: number }
    linger: { value: number }
    podiumTop: { value: number }
  } | null>(null)
  // The confetti's own clock, which runs only while it plays and never jumps by more than a
  // short step, so it lands as it should after a stall
  const clock = useRef({ time: 0, computeUntil: 0, visibleUntil: 0, warm: false })
  // A cue waiting for the next frame, which starts it on the confetti's clock
  const pending = useRef<{ mode: number; x: number; z: number } | null>(null)
  // The host has changed place, so the pieces lying where the podium stood, or stands now, settle
  // onto what is there
  const settle = useRef(false)

  useLayoutEffect(() => {
    const { gl, scene } = get()
    if (!(gl instanceof WebGPURenderer)) return undefined

    // One uniform for both, whose numbers are written in place: a number set on a uniform of its
    // own would be boxed anew every frame
    const timing = uniform(new Vector2())
    const now = timing.x
    const step = timing.y
    // Each burst or shower is a new generation, the first of them 0, and a piece of any other
    // starts afresh. The buffers start at 0 as well, so the run at mount moves every piece to -1
    const generation = uniform(-1)
    const mode = uniform(burst)
    const origin = uniform(new Vector3())
    const start = uniform(0)
    const linger = uniform(burstLinger)
    // The podium's top where it stands, and the floor where it doesn't
    const podiumTop = uniform(podiumTopFor(useEffects.getState().host))
    // Over the podium a piece lands on its top
    const { hostSpot } = places.podium
    const groundAt = (position: Node<'vec3'>, rest: Node<'float'>) => {
      const overPodium = position.xz
        .sub(vec2(hostSpot.x, hostSpot.z))
        .length()
        .lessThan(podium.radius)
      return select(overPodium, rest.add(podiumTop), rest)
    }

    // Four numbers a piece in every buffer, read and written whole: a 2014 Intel Mac's Metal
    // compiler fails on a compute pass that writes single fields of three-number elements
    const positions = instancedArray(mostConfetti, 'vec4')
    const velocities = instancedArray(mostConfetti, 'vec4')
    // When the piece landed (below 0 while it flies), its generation, and when it sets off
    const states = instancedArray(mostConfetti, 'vec4')

    // A piece's own random numbers, the same for every generation, each from its own stretch of
    // the hash's inputs
    const trait = (salt: number) => hash(instanceIndex.add(salt * mostConfetti))
    // And ones new for each generation, so no two bursts look alike, from stretches beyond every
    // trait's, in whole numbers, which wrap rather than lose precision however many bursts there are
    const fresh = (salt: number) =>
      hash(
        instanceIndex
          .add(uint(generation.add(1)).mul(generationStride * mostConfetti))
          .add(salt * mostConfetti),
      )
    const fall = trait(1).mul(fallRange).add(fallLeast)
    const rest = trait(2).mul(restRange).add(restLeast)

    const update = Fn(() => {
      const position = positions.element(instanceIndex).xyz.toVar()
      const velocity = velocities.element(instanceIndex).xyz.toVar()
      const state = states.element(instanceIndex).toVar()

      If(state.y.notEqual(generation), () => {
        If(mode.equal(burst), () => {
          const angle = fresh(1).mul(TWO_PI)
          const out = fresh(2).mul(outMost)
          const offset = fresh(3).mul(0.12)
          position.assign(
            origin.add(vec3(cos(angle).mul(offset), fresh(4).mul(0.1), sin(angle).mul(offset))),
          )
          velocity.assign(
            vec3(cos(angle).mul(out), fresh(5).mul(upRange).add(upLeast), sin(angle).mul(out)),
          )
          state.assign(vec4(-1, generation, start.add(fresh(6).mul(burstStagger)), 0))
        }).Else(() => {
          position.assign(
            vec3(
              fresh(1).mul(2).sub(1).mul(showerHalfWidth),
              fresh(2).mul(showerHeight).add(showerLow),
              fresh(3).mul(showerDepth).add(showerBack),
            ),
          )
          velocity.assign(vec3(0, fall.negate(), 0))
          state.assign(vec4(-1, generation, start.add(fresh(6).mul(showerSpread)), 0))
        })
      }).ElseIf(state.x.lessThan(0).and(now.greaterThanEqual(state.z)), () => {
        velocity.assign(
          velocity.sub(vec3(0, step.mul(gravity), 0)).mul(float(1).sub(step.mul(drag))),
        )
        velocity.y.assign(max(velocity.y, fall.negate()))
        const swaying = now.mul(trait(3).mul(swayRange).add(swayLeast)).add(trait(4).mul(TWO_PI))
        const drift = vec3(sin(swaying), 0, cos(swaying.mul(0.8))).mul(sway)
        position.assign(position.add(velocity.add(drift).mul(step)))
        // A piece that meets the podium's side comes to rest on the top at its edge rather than
        // inside it
        const ground = groundAt(position, rest)
        If(position.y.lessThanEqual(ground), () => {
          position.y.assign(ground)
          state.x.assign(now)
        })
      }).ElseIf(state.x.greaterThanEqual(0), () => {
        // A landed piece lies on whatever is under it now
        position.y.assign(groundAt(position, rest))
      })

      positions.element(instanceIndex).assign(vec4(position, 0))
      velocities.element(instanceIndex).assign(vec4(velocity, 0))
      states.element(instanceIndex).assign(state)
    })().compute(mostConfetti)

    // Each piece where the compute pass left it, tumbling as it falls and lying flat once landed,
    // drawn only from when it sets off, and shrinking away once it has lain long enough
    const place = positions.toAttribute().xyz
    const state = states.toAttribute()
    const landed = state.x.greaterThanEqual(0)
    const flying = state.y.equal(generation).and(now.greaterThanEqual(state.z))
    const shrink = select(
      landed,
      smoothstep(linger, linger.add(shrinkTime), now.sub(state.x)).oneMinus(),
      float(1),
    )
    const size = select(flying, shrink, float(0))
    const spin = now.mul(trait(5).mul(spinRange).add(spinLeast)).add(trait(6).mul(TWO_PI))
    const axis = vec3(trait(7), trait(8), trait(9)).sub(0.5)
    const turn = select(landed, vec3(PI.div(2), 0, trait(6).mul(TWO_PI)), axis.mul(spin))

    // A piece face-on to the camera is bright, edge-on darker, so the cloud glitters as it tumbles
    const facing = abs(rotate(vec3(0, 0, 1), turn).dot(cameraPosition.sub(place).normalize()))
    const pick = trait(10).mul(palette.length).floor()
    let paper: Node<'color'> = color(palette[0])
    for (let i = 1; i < palette.length; i++) {
      paper = select(pick.equal(i), color(palette[i]), paper)
    }

    const geometry = new PlaneGeometry(pieceWidth, pieceHeight)
    const material = new MeshBasicNodeMaterial({ side: DoubleSide })
    material.positionNode = rotate(positionLocal.mul(size), turn).add(place)
    material.colorNode = vertexStage(paper.mul(facing.mul(0.65).add(0.35)))
    const mesh = new Mesh(geometry, material)
    mesh.count = useEffects.getState().confettiCount
    // The pieces are placed by the GPU, far from the plane the mesh is made of
    mesh.frustumCulled = false
    // Decoration: it takes no presses
    mesh.raycast = () => undefined
    scene.add(mesh)
    // Run over every piece the buffers hold and drawn once now, every piece hidden, so the shaders
    // are ready before the first win rather than made in the middle of it. A piece the run missed
    // would still be at 0, the first burst or shower's generation, and lie in the stage's middle
    void gl.compute(update)
    clock.current = { time: 0, computeUntil: 0, visibleUntil: 0, warm: true }

    parts.current = {
      renderer: gl,
      mesh,
      update,
      updates: [update],
      timing,
      generation,
      mode,
      origin,
      start,
      linger,
      podiumTop,
    }
    return () => {
      parts.current = null
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
      update.dispose()
      for (const buffer of [positions, velocities, states]) buffer.value.dispose()
    }
  }, [get])

  useLayoutEffect(
    () =>
      useEffects.subscribe(({ host }, previous) => {
        if (host === previous.host || !parts.current) return
        parts.current.podiumTop.value = podiumTopFor(host)
        settle.current = true
      }),
    [],
  )

  useCelebrationCues({
    onCue: (name, final) => {
      if (name === 'win' && final !== null) {
        const [x, z] = crates[final]
        pending.current = { mode: burst, x, z }
      } else if (name === 'finale') {
        pending.current = { mode: shower, x: 0, z: 0 }
      }
    },
    onReset: () => {
      pending.current = null
      clock.current.computeUntil = clock.current.visibleUntil = 0
      if (parts.current) parts.current.mesh.visible = false
    },
  })

  useFrame((_, delta) => {
    const made = parts.current
    if (!made) return
    const c = clock.current
    const cue = pending.current
    if (cue) {
      pending.current = null
      // The count is taken as each burst starts, so a change of the slider never draws pieces the
      // compute pass hasn't started
      const count = useEffects.getState().confettiCount
      made.mesh.count = count
      made.update.count = count
      made.generation.value += 1
      made.mode.value = cue.mode
      made.start.value = c.time + (cue.mode === burst ? burstDelay : 0)
      made.origin.value.set(cue.x, crateTop, cue.z)
      made.linger.value = cue.mode === burst ? burstLinger : forever
      c.computeUntil = c.time + (cue.mode === burst ? burstFlight : showerFlight)
      c.visibleUntil =
        cue.mode === burst ? c.computeUntil + burstLinger + shrinkTime : Number.POSITIVE_INFINITY
      made.mesh.visible = true
      c.warm = false
    }
    if (!made.mesh.visible) {
      // Nothing lies on the stage, and the next burst starts afresh
      settle.current = false
      return
    }
    if (settle.current && !c.warm) {
      settle.current = false
      // A step of nothing, which moves no piece in the air
      made.timing.value.set(c.time, 0)
      void made.renderer.compute(made.updates)
    }
    // The frame that draws it once, hidden, to make its shaders
    if (c.warm) {
      c.warm = false
      return
    }
    if (c.time >= c.visibleUntil) {
      made.mesh.visible = false
      return
    }
    const step = Math.min(delta, longestStep)
    c.time += step
    made.timing.value.set(c.time, step)
    if (c.time <= c.computeUntil) {
      void made.renderer.compute(made.updates)
    }
  })

  return null
}
