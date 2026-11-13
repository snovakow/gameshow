import { useLayoutEffect, useRef } from 'react'
import type { DirectionalLight, Object3D } from 'three'

// The sun shines down from above and a little to the front and right of the stage's middle, its
// shadow drawn over a box just wide enough to hold every crate, the host's podium and the host on
// it, with a tenth of a unit to spare
const sunTarget = [0, 0, -1] as const
const sunPlace = [0.5, 2, -0.5] as const
const shadowHalf = 2.4

export function Lights() {
  const sun = useRef<DirectionalLight>(null)
  const aim = useRef<Object3D>(null)

  // The sun aims its shadow at its target's place in the scene, which three reads from the
  // target's world matrix, so the target stands in the scene where it can be kept up to date
  useLayoutEffect(() => {
    if (sun.current && aim.current) sun.current.target = aim.current
  }, [])

  return (
    <>
      <directionalLight
        ref={sun}
        color={0xffe499}
        intensity={5}
        position={sunPlace}
        castShadow
        shadow-camera-near={0.1}
        shadow-camera-far={5}
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowHalf}
        shadow-camera-bottom={-shadowHalf}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.005}
        shadow-intensity={1}
        shadow-radius={3}
      />
      <object3D ref={aim} position={sunTarget} />
      <hemisphereLight args={[0x333366, 0x74ccf4, 5]} />
      <hemisphereLight args={[0x74ccf4, 0x000000, 1]} />
    </>
  )
}
