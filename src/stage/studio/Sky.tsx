import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect } from 'react'
import { NeutralToneMapping, NoToneMapping } from 'three'
import { color, hue, normalWorld, time } from 'three/tsl'

// The night's deep blue, overhead
const night = 0x0066ff
// A tenth of it: dark enough that the lit stage stands out against it
const nightBrightness = 0.1
// The studio is lit for Neutral's response, at a little over the scene's own brightness
const exposure = 1.3

// The studio's night sky, after webgpu_reflection_blurred: a dark blue whose hue turns round the
// colour wheel once every 2π seconds. And the studio's tone mapping, which rolls bright lights off
// toward white rather than clipping them, and which the daylight stage doesn't use
export function Sky() {
  const get = useThree((s) => s.get)

  // A passive effect, as the daylight sky's is, so whichever look takes over sets the background
  // after the other has cleared it
  useEffect(() => {
    const { scene } = get()
    scene.backgroundNode = hue(normalWorld.y.mix(0, color(night)).mul(nightBrightness), time)
    return () => {
      scene.backgroundNode = null
    }
  }, [get])

  // A layout effect, so the frame the look changes in draws with its tone mapping. A change of tone
  // mapping rebuilds the render pipeline's frame, which the pipeline makes afresh for the look
  useLayoutEffect(() => {
    const { gl } = get()
    gl.toneMapping = NeutralToneMapping
    gl.toneMappingExposure = exposure
    return () => {
      // As the Canvas's flat prop leaves it, for the daylight stage
      gl.toneMapping = NoToneMapping
      gl.toneMappingExposure = 1
    }
  }, [get])

  return null
}
