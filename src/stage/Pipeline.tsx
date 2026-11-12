import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { NormalBlending, UnsignedByteType, type Object3D } from 'three'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { outline } from 'three/addons/tsl/display/OutlineNode.js'
import {
  color,
  emissive,
  float,
  mix,
  mrt,
  oscSine,
  output,
  pass,
  renderOutput,
  saturate,
  time,
  vec4,
} from 'three/tsl'
import { BlendMode, RenderPipeline, WebGPURenderer, type Node } from 'three/webgpu'
import { useEffects } from './effects.ts'
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
// once, with what each material emits beside it for the bloom, then the bloom, the outline and
// FXAA over it. It's mounted only while one of them is on, so with every effect off R3F draws the
// frame itself, exactly as before
export function Pipeline() {
  const get = useThree((s) => s.get)
  const bloomOn = useEffects((s) => s.bloom)
  const outlineOn = useEffects((s) => s.outline)
  const antialiasing = useEffects((s) => s.antialiasing)
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
    let frame: Node<'vec3'> = sceneColor.rgb

    if (bloomOn) {
      scenePass.setMRT(withEmissive)
      // A byte a channel, half the bandwidth of the scene's own half floats. What emits here stays
      // within 0 to 1, which a byte holds; anything brighter would clip at 1
      scenePass.getTexture('emissive').type = UnsignedByteType
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
  }, [get, bloomOn, outlineOn, antialiasing])

  // A positive priority takes the frame from R3F, which then leaves drawing to this
  useFrame(() => pipeline.current?.render(), 1)

  return null
}
