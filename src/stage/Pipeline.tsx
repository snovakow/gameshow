import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import {
  Color,
  Layers,
  MirroredRepeatWrapping,
  NormalBlending,
  UnsignedByteType,
  type Object3D,
} from 'three'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import { outline } from 'three/addons/tsl/display/OutlineNode.js'
import { radialBlur } from 'three/addons/tsl/display/radialBlur.js'
import {
  Fn,
  If,
  Loop,
  color,
  emissive,
  float,
  int,
  luminance,
  mix,
  mrt,
  oscSine,
  output,
  pass,
  renderOutput,
  rtt,
  saturate,
  screenUV,
  smoothstep,
  time,
  uv,
  vec2,
  vec4,
  viewportSize,
} from 'three/tsl'
import { BlendMode, RenderPipeline, WebGPURenderer, type Node } from 'three/webgpu'
import { useEffects } from './effects.ts'
import { beamLayer, useBeamVolume } from './effects/beamVolume.ts'
import { StreakReach, streakScale, streakSpacing, streakTaps } from './effects/streakReach.ts'
import { ZoomBurst, burstCentre, burstStrength } from './effects/zoomBurst.ts'
import { useOutlined } from './outlined.ts'

// How far the glow spreads, from 0, close around what shines, to 1, wide
const bloomRadius = 0.2
// The outline is gold where the crate shows and a dim bronze where something stands in front of it
const visibleEdge = 0xffd700
const hiddenEdge = 0x6b4f1d
// The outline's edge comes back faint and soft, so it's scaled up until its middle draws solid,
// at the top of its pulse
const edgeStrength = 4
// How wide the edge spreads, in the outline's own half-resolution pixels
const edgeThickness = 2
// The outline pulses between half and full strength this many times a second
const pulseRate = 0.75

// The streaks: only the brightest emitters streak, the bulbs and the fireworks, rather than all
// that glows
const streakThreshold = 0.45
const streakSoftness = 0.2
// The cool blue of a widescreen lens's flare, and how bright the streaks are against the bloom
const streakTint = 0x7a8aff
const streakStrength = 6

// The zoom burst: how many steps toward the winning crate each pixel looks, how much less each
// step counts than the one before, and how bright the blurred picture is laid over the sharp one
const burstSteps = 32
const burstDecay = 0.95
const burstExposure = 2.5

// The light beams: how far the blur reaches over the beams' own pixels, smoothing the steps'
// grain, and how bright the beams are laid over the picture
const beamSmoothing = 0.6
const beamBrightness = 2.5

// Streaks drawn from the bloom's bright pass, after three's anamorphic example: the bright parts
// of what shines are kept once in a texture of their own, then each pixel gathers it from either
// side along the row, nearer taps counting more, so a point of light becomes a level line. How far
// the taps reach follows the stage (streakReach.ts), and the streak's light is shared out over
// them, so as the camera nears a bulb, the bulb and its streak grow together and keep their
// brightness. Every texture it keeps is handed to made, to go with the rest of the pipeline's frame
function streakPass(source: Node<'vec4'>, made: Disposable[]) {
  const streaks = bloom(source, streakStrength, 0, streakThreshold)
  streaks.smoothWidth.value = streakSoftness
  streaks.setResolutionScale(streakScale)
  streaks.highPassFn = ({ input, threshold, smoothWidth }) => {
    const bright = smoothstep(threshold, threshold.add(smoothWidth), luminance(input.rgb))
    // At the bloom's own resolution, which the taps' spacing counts in
    const kept = rtt(mix(vec4(0), input, bright), null, null, {
      wrapS: MirroredRepeatWrapping,
      wrapT: MirroredRepeatWrapping,
      resolutionScale: streakScale,
    })
    made.push(kept)
    return Fn(() => {
      const total = vec4(0).toVar()
      const step = streakSpacing.div(viewportSize.x)
      Loop({ start: streakTaps.negate(), end: streakTaps }, ({ i }) => {
        const nearness = float(i).abs().div(streakTaps).oneMinus().pow(2)
        total.addAssign(kept.sample(vec2(uv().x.add(step.mul(i)), uv().y)).mul(nearness))
      })
      // The taps' nearness adds up to about two-thirds of their count either side
      return total.div(streakTaps.mul(2).div(3))
    })()
  }
  return streaks
}

// The picture drawn outward from the burst's centre while the burst is under way, and as it is
// otherwise: a branch the whole frame takes together, so between bursts the blur costs nothing
function burstPass(picture: Node<'vec4'>) {
  return Fn(() => {
    const shown = vec4(picture).toVar()
    If(burstStrength.greaterThan(0), () => {
      shown.assign(
        radialBlur(picture, {
          center: burstCentre,
          weight: burstStrength,
          decay: float(burstDecay),
          count: int(burstSteps),
          exposure: float(burstExposure),
        }),
      )
    })
    return shown
  })()
}

// Each material writes what it emits to a second target beside its colour, which only the bloom
// reads, so only what shines glows; the emissive target blends as a material's colour does. One
// for the page's life: three keeps a set of drawing state for every object in the scene for each
// of these it draws with, by its id, and keeps that set until the objects go, so a new one at each
// rebuild would leave a set behind every time
const withEmissive = mrt({ output, emissive: vec4(emissive, output.a) })
withEmissive.setBlendMode('emissive', new BlendMode(NormalBlending))

interface Disposable {
  dispose: () => void
}

// Draws the frame in R3F's place whenever an effect needs more than the scene alone: the scene
// once, with what each material emits beside it for the bloom and the streaks, the zoom burst
// over it, the light beams in a small pass of their own, then the bloom, the streaks, the beams,
// the outline and FXAA over it. It's mounted only while one of them is on, so with every effect
// off R3F draws the frame itself, exactly as before
export function Pipeline({ crates: places }: { crates: [number, number][] }) {
  const get = useThree((s) => s.get)
  const bloomOn = useEffects((s) => s.bloom)
  const outlineOn = useEffects((s) => s.outline)
  const antialiasing = useEffects((s) => s.antialiasing)
  const streaksOn = useEffects((s) => s.streaks)
  const burstOn = useEffects((s) => s.zoomBurst)
  // Whether the light beams' haze is there to draw, which their switch decides
  const beamsShown = useBeamVolume((s) => s.material !== null)
  const pipeline = useRef<RenderPipeline | null>(null)

  // Made once for as long as an effect is on; the switches change only what it draws
  useLayoutEffect(() => {
    const { gl } = get()
    if (!(gl instanceof WebGPURenderer)) return undefined
    const made = new RenderPipeline(gl)
    pipeline.current = made
    return () => {
      // Its own quad only; what it draws is disposed with the switches that made it
      made.dispose()
      pipeline.current = null
    }
  }, [get])

  // What the pipeline draws, for the switches as they are
  useLayoutEffect(() => {
    const target = pipeline.current
    if (!target) return undefined
    const { scene, camera } = get()
    const smoothed = antialiasing === 'fxaa'
    // FXAA smooths the finished frame, so the scene draws without MSAA's samples
    const scenePass = pass(scene, camera, smoothed ? { samples: 0 } : {})
    const made: Disposable[] = [scenePass]
    const unsubscribes: (() => void)[] = []
    const sceneColor = scenePass.getTextureNode()
    let frame: Node<'vec3'> = (burstOn ? burstPass(sceneColor) : sceneColor).rgb

    if (bloomOn || streaksOn) {
      scenePass.setMRT(withEmissive)
      // A byte a channel, half the bandwidth of the scene's own half floats. What emits here stays
      // within 0 to 1, which a byte holds; anything brighter would clip at 1
      scenePass.getTexture('emissive').type = UnsignedByteType
    }

    if (bloomOn) {
      const bloomPass = bloom(
        scenePass.getTextureNode('emissive'),
        useEffects.getState().bloomStrength,
        bloomRadius,
      )
      // The strength is a uniform, so its slider changes it without rebuilding anything
      unsubscribes.push(
        useEffects.subscribe(({ bloomStrength }) => {
          bloomPass.strength.value = bloomStrength
        }),
      )
      made.push(bloomPass)
      frame = frame.add(bloomPass.rgb)
    }

    if (streaksOn) {
      const streaks = streakPass(scenePass.getTextureNode('emissive'), made)
      made.push(streaks)
      frame = frame.add(streaks.rgb.mul(color(new Color(streakTint))))
    }

    const beams = beamsShown ? useBeamVolume.getState().material : null
    if (beams) {
      // The haze stops where the stage's view has drawn something in front of it
      beams.depthNode = scenePass.getTextureNode('depth').sample(screenUV)
      beams.needsUpdate = true
      const only = new Layers()
      only.set(beamLayer)
      // Its own small picture, of the haze alone, with nothing to test its depth against and no
      // samples to smooth its edges, which the blur softens anyway
      const beamPass = pass(scene, camera, { depthBuffer: false, samples: 0 })
      beamPass.setLayers(only)
      beamPass.setResolutionScale(useEffects.getState().beamResolution)
      unsubscribes.push(
        useEffects.subscribe(({ beamResolution }) => {
          if (beamResolution !== beamPass.getResolutionScale()) {
            beamPass.setResolutionScale(beamResolution)
          }
        }),
      )
      // The renderer draws a scene's background in every view of it, whatever its layers, which
      // would add the studio's sky to the picture a second time, so the beams' pass draws without
      const onBeforeRender = scene.onBeforeRender.bind(scene)
      const onAfterRender = scene.onAfterRender.bind(scene)
      let background = scene.backgroundNode
      scene.onBeforeRender = (...drawing) => {
        onBeforeRender(...drawing)
        if (drawing[2].layers.mask !== only.mask) return
        background = scene.backgroundNode
        scene.backgroundNode = null
      }
      scene.onAfterRender = (...drawing) => {
        onAfterRender(...drawing)
        if (drawing[2].layers.mask !== only.mask) return
        scene.backgroundNode = background
      }
      unsubscribes.push(() => {
        scene.onBeforeRender = onBeforeRender
        scene.onAfterRender = onAfterRender
        beams.depthNode = null
        beams.needsUpdate = true
      })
      const softened = gaussianBlur(beamPass, beamSmoothing)
      made.push(beamPass, softened)
      frame = frame.add(softened.rgb.mul(beamBrightness))
    }

    if (outlineOn) {
      // A list of the pipeline's own, kept in step with the crates', since the outline empties the
      // list it was given when it's disposed
      const selected: Object3D[] = []
      const select = ({ crates }: { crates: Object3D[] }) => {
        selected.length = 0
        selected.push(...crates)
      }
      select(useOutlined.getState())
      unsubscribes.push(useOutlined.subscribe(select))
      const edges = outline(scene, camera, {
        selectedObjects: selected,
        edgeThickness: float(edgeThickness),
      })
      const strength = oscSine(time.mul(pulseRate)).mul(0.5).add(0.5).mul(edgeStrength)
      // Mixed toward the edge's colour rather than added to the frame, so the outline reads as gold
      // over the pale floor tiles too, where an added gold would wash out to white
      frame = mix(frame, color(visibleEdge), saturate(edges.visibleEdge.mul(strength)))
      frame = mix(frame, color(hiddenEdge), saturate(edges.hiddenEdge.mul(strength)))
      made.push(edges)
    }

    // The scene's own alpha, which the bloom and the outline would otherwise add to
    const composite = vec4(frame, sceneColor.a)
    if (smoothed) {
      // FXAA reads the frame as it will be shown, so the colour transform comes first
      const finished = fxaa(renderOutput(composite))
      made.push(finished.textureNode, finished)
      target.outputNode = finished
      target.outputColorTransform = false
    } else {
      target.outputNode = composite
      target.outputColorTransform = true
    }
    target.needsUpdate = true

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe()
      for (const node of made) node.dispose()
    }
  }, [get, bloomOn, outlineOn, antialiasing, streaksOn, burstOn, beamsShown])

  // A positive priority takes the frame from R3F, which then leaves drawing to this
  useFrame(() => pipeline.current?.render(), 1)

  return (
    <>
      {burstOn && <ZoomBurst crates={places} />}
      {streaksOn && <StreakReach />}
    </>
  )
}
