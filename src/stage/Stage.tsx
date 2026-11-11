import { OrbitControls, Stats } from '@react-three/drei'
import { Suspense } from 'react'
import { Backdrop } from './Backdrop.tsx'
import { Crate } from './Crate.tsx'
import { Floor } from './Floor.tsx'
import { Host } from './Host.tsx'
import { Lights } from './Lights.tsx'
import { SpeechBubble } from './SpeechBubble.tsx'

// Where the crates stand, on x and z; numbered 1, 2 and 3 in this order, which reads left to
// right from the opening view
const crates: [number, number][] = [
  [-1.5, 0],
  [0, -1.5],
  [1.5, 0],
]

export function Stage() {
  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping={false}
        minDistance={1}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2}
        target={[0, 0.5, 0]}
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
