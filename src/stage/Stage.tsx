import { OrbitControls, Stats } from '@react-three/drei'
import { Backdrop } from './Backdrop.tsx'
import { Crate } from './Crate.tsx'
import { Floor } from './Floor.tsx'
import { Lights } from './Lights.tsx'

// Where the crates stand, on x and z
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
      <Stats />
    </>
  )
}
