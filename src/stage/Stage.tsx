import { CameraControls, Stats, type CameraControlsImpl } from '@react-three/drei'
import { Suspense, useRef } from 'react'
import { Backdrop } from './Backdrop.tsx'
import { Crate } from './Crate.tsx'
import { Floor } from './Floor.tsx'
import { Host } from './Host.tsx'
import { Lights } from './Lights.tsx'
import { SpeechBubble } from './SpeechBubble.tsx'
import { useFraming } from './useFraming.ts'

// Where the crates stand, on x and z; numbered 1, 2 and 3 in this order, which reads left to
// right from the opening view
const crates: [number, number][] = [
  [-1.5, 0],
  [0, -1.5],
  [1.5, 0],
]

// camera-controls eases every change of view; at the shortest time it accepts, the ease is over
// within a frame, so the camera follows the pointer without lag
const instant = 0.0001

export function Stage() {
  const controls = useRef<CameraControlsImpl>(null)
  useFraming(controls, crates)

  // A trackpad pinch arrives as a ctrl+wheel, which camera-controls turns into the lens's zoom,
  // outside the distance limits, so the zoom is pinned at 1. The framing sets the opening view
  return (
    <>
      <CameraControls
        ref={controls}
        makeDefault
        minDistance={1}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2}
        minZoom={1}
        maxZoom={1}
        smoothTime={instant}
        draggingSmoothTime={instant}
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
      <Stats />
    </>
  )
}
