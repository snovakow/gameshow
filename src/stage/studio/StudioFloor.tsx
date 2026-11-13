import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { type Mesh } from 'three'
import { hashBlur } from 'three/addons/tsl/display/hashBlur.js'
import {
  color,
  luminance,
  mix,
  output,
  rangeFogFactor,
  reflector,
  sample,
  screenUV,
  smoothstep,
  uniform,
  vec3,
  vec4,
} from 'three/tsl'
import { MeshStandardNodeMaterial, type Node } from 'three/webgpu'
import { useEffects } from '../effects.ts'

// A near-black floor, a little blue, for the lights to pool on
const floorColour = 0x0c0d14
// A satin finish: the spots spread into soft pools rather than sharp glints
const floorRoughness = 0.55
// How much of the stage the floor reflects, once its highlights are rolled off
const reflectionStrength = 0.35
// The floor fades into the sky from this far from the camera to this far, as Daylight's fog does
const fadeStart = 7
const fadeEnd = 25
// How far the glossy blur spreads, between its own least and most; the example's middle setting
const blurRadius = 0.2
// The part of the reflection bright enough to glow, in the reflected scene's own light: what
// shines, such as a lit bulb, and not the lit wood, skin and cloth around it, whose highlights can
// reach 1 under the key light
const glowFrom = 1
const glowTo = 2

// The panel's Gloss, the reflection's blur, kept in step with the panel while the floor is down
const gloss = uniform(useEffects.getState().gloss)

type Reflection = ReturnType<typeof reflector>

// The stage reflected in the floor at half the render's resolution, drawn once a frame, the
// floor's own reflections left out. The glossy blur also reads how far each reflected point lies
// beyond the floor
function reflection({ glossy }: { glossy: boolean }) {
  return reflector({ resolutionScale: 0.5, depth: glossy, bounces: false })
}

// The reflection as a glossy floor blurs it, after webgpu_reflection_blurred: sharp where the
// reflected thing touches the floor and softer the further it stands beyond it, by about eighty
// reads of the reflection for each pixel of floor
function blurred(sharp: Reflection): Node<'vec3'> {
  const depth = sharp.getDepthNode()
  const radiusRange = mix(0.01, 0.1, blurRadius)
  const roughnessRange = mix(0.3, 0.03, gloss)
  // Where nothing was reflected, nothing is blurred in
  const masked = sample((uv) => {
    const seen = sharp.sample(uv)
    return vec4(seen.rgb, seen.a.mul(depth.sample(uv).r))
    // The reflector's own screen-space UVs, mirrored across
  }, screenUV.flipX())
  const blur = hashBlur(masked, radiusRange, { repeats: 40, premultipliedAlpha: true })
  const mask = blur.a.mul(depth.r).remapClamp(0, roughnessRange)
  return mix(sharp.rgb, blur.rgb, mask.mul(gloss.mul(2).min(1)))
}

// The studio's floor: dark, fading into the night, reflecting the stage. Each switch rebuilds the
// floor's material, so what's off costs nothing
export function StudioFloor() {
  const get = useThree((s) => s.get)
  const mesh = useRef<Mesh>(null)
  const reflectionOn = useEffects((s) => s.reflection)
  const glossyOn = useEffects((s) => s.glossy)

  useEffect(
    () =>
      useEffects.subscribe((effects) => {
        gloss.value = effects.gloss
      }),
    [],
  )

  // A layout effect, so the floor has its material before the first frame draws it
  useLayoutEffect(() => {
    const { scene } = get()
    gloss.value = useEffects.getState().gloss

    const material = new MeshStandardNodeMaterial({ roughness: floorRoughness, metalness: 0 })
    material.transparent = true
    // Seen from the camera, the floor thins into the sky between the two distances
    material.colorNode = vec4(color(floorColour), rangeFogFactor(fadeStart, fadeEnd).oneMinus())

    // What the floor reflects, in the scene's own light
    let seen: Node<'vec3'> = vec3(0)
    const cleanups: (() => void)[] = []
    if (reflectionOn) {
      const sharp = reflection({ glossy: glossyOn })
      sharp.target.rotateX(-Math.PI / 2)
      scene.add(sharp.target)
      cleanups.push(() => {
        scene.remove(sharp.target)
        sharp.dispose()
      })
      seen = glossyOn ? blurred(sharp) : sharp.rgb
    }
    // Highlights rolled off toward 1, so a glint under the key light doesn't outshine the rest of
    // the reflection and the reflected stage reads whole rather than as loose bright lines
    const reflected = seen.div(seen.add(1)).mul(reflectionStrength)
    // Only the reflection's brightest parts glow, so what shines still shines in the floor
    const glow = reflected.mul(smoothstep(glowFrom, glowTo, luminance(seen)))
    // What the floor emits reaches the bloom: the reflection's brightest parts
    material.emissiveNode = glow
    // The rest of the reflection joins the floor's finished colour, after its lighting, so it shows
    // the same in a spot's pool as in the dark between them, as a gloss does, and blooms nowhere
    material.outputNode = vec4(output.rgb.add(reflected.sub(glow)), output.a)

    if (mesh.current) mesh.current.material = material
    return () => {
      for (const cleanup of cleanups) cleanup()
      material.dispose()
    }
  }, [get, reflectionOn, glossyOn])

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[50, 50]} />
    </mesh>
  )
}
