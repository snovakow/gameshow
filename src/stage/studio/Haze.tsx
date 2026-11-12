import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect } from 'react'
import { color, exponentialHeightFogFactor, fog, renderGroup, uniform } from 'three/tsl'
import { useEffects } from '../effects.ts'

// A blue-grey just lighter than the floor, so the haze reads as lit air over it
const hazeColour = 0x1c2444
// The haze lies below this height, thickest at the floor; the crates stand in it to their middles
const hazeTop = 0.6

// The panel's Thickness, and the top of the haze, for every draw in a frame
const density = uniform(useEffects.getState().hazeDensity).setGroup(renderGroup)
const height = uniform(hazeTop).setGroup(renderGroup)

// A haze lying low over the studio floor, after webgpu_fog_height, thickening with distance and
// with depth below its top
export function Haze() {
  const get = useThree((s) => s.get)

  useEffect(
    () =>
      useEffects.subscribe((effects) => {
        density.value = effects.hazeDensity
      }),
    [],
  )

  // A layout effect, so the frame the switch changes in draws with it. It takes the place of the
  // daylight stage's fog, which the studio doesn't have
  useLayoutEffect(() => {
    const { scene } = get()
    density.value = useEffects.getState().hazeDensity
    scene.fogNode = fog(color(hazeColour), exponentialHeightFogFactor(density, height))
    return () => {
      scene.fogNode = null
    }
  }, [get])

  return null
}
