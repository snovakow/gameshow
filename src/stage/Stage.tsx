import { OrbitControls, Stats } from '@react-three/drei'
import { Backdrop } from './Backdrop.tsx'
import { Floor } from './Floor.tsx'
import { Lights } from './Lights.tsx'

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
      <Stats />
    </>
  )
}
