import { CameraControls, Stats, type CameraControlsImpl } from '@react-three/drei'
import { Suspense, useEffect, useRef } from 'react'
import { Box3, MathUtils, Vector3 } from 'three'
import { Backdrop } from './Backdrop.tsx'
import { Crate } from './Crate.tsx'
import { Floor } from './Floor.tsx'
import { Host } from './Host.tsx'
import { Lights } from './Lights.tsx'
import { SpeechBubble } from './SpeechBubble.tsx'
import { useFraming } from './useFraming.ts'
import { touches, useGestures } from './useGestures.ts'
import { instant, useHomeView } from './useHomeView.ts'

// Where the crates stand, on x and z; numbered 1, 2 and 3 in this order, which reads left to
// right from the opening view
const crates: [number, number][] = [
  [-1.5, 0],
  [0, -1.5],
  [1.5, 0],
]

// The lowest the view tilts, 10° above level: nearer the horizon the stage is seen head-on and the
// floor, drawn from above only, thins to nothing
const lowestView = MathUtils.degToRad(80)

export function Stage() {
  const controls = useRef<CameraControlsImpl>(null)
  useFraming(controls, crates)
  const takeOver = useHomeView(controls, crates)
  useGestures(controls, takeOver)

  // A pan moves the point the camera turns around, and the camera stands at or above it, so the
  // point is kept on or above the floor: a pan that meets the floor slides along it rather than
  // taking the camera under the stage
  useEffect(() => {
    const cameraControls = controls.current
    if (!cameraControls) return undefined
    const aboveFloor = new Box3(
      new Vector3(-Infinity, 0, -Infinity),
      new Vector3(Infinity, Infinity, Infinity),
    )
    cameraControls.setBoundary(aboveFloor)
    return () => {
      cameraControls.setBoundary()
    }
  }, [])

  // A trackpad pinch arrives as a ctrl+wheel, which camera-controls turns into the lens's zoom,
  // outside the distance limits, so the zoom is pinned at 1 and the pinch moves the camera instead
  // (useGestures). The framing sets the opening view and the lens
  return (
    <>
      <CameraControls
        ref={controls}
        makeDefault
        minDistance={1}
        maxDistance={10}
        maxPolarAngle={lowestView}
        minZoom={1}
        maxZoom={1}
        smoothTime={instant}
        draggingSmoothTime={instant}
        touches={touches}
      />
      <Lights />
      <Backdrop />
      <Floor />
      {crates.map(([x, z], index) => (
        <Crate key={index} index={index} x={x} z={z} />
      ))}
      {/* The host and her clips are large, so the rest of the stage doesn't wait for them */}
      <Suspense fallback={null}>
        <Host />
      </Suspense>
      <SpeechBubble />
      <Stats className="meter" />
    </>
  )
}
