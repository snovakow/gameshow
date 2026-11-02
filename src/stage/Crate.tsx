import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { DoubleSide, Mesh, MeshPhongMaterial, PlaneGeometry, TextureLoader, type Group } from 'three'
import { useGame } from '../store.ts'
import { Prize } from './Prize.tsx'

const size = 0.75
const half = size / 2

export function Crate({ index, x, z }: { index: number; x: number; z: number }) {
  const crate = useLoader(TextureLoader, `${import.meta.env.BASE_URL}textures/crate.gif`)
  const prize = useGame((s) => s.crates[index].prize)
  const openings = useGame((s) => s.crates[index].openings)
  const open = useGame((s) => s.open)
  const get = useThree((s) => s.get)
  const sides = useRef<Group>(null)
  const lid = useRef<Group>(null)
  const rise = useRef<Group>(null)
  // When the lid's swing started, on R3F's clock, or null while it isn't swinging
  const swingStart = useRef<number | null>(null)

  // A layout effect, so the sides have their material before the first frame draws them
  useLayoutEffect(() => {
    // Loaded textures are cached and shared, so each crate sets up its own copy
    const map = crate.clone()
    map.anisotropy = 4
    const geometry = new PlaneGeometry(size, size)
    const material = new MeshPhongMaterial({ map, side: DoubleSide })
    sides.current?.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry = geometry
        object.material = material
      }
    })

    return () => {
      geometry.dispose()
      material.dispose()
      map.dispose()
    }
  }, [crate])

  useEffect(() => {
    if (openings > 0) swingStart.current = get().clock.elapsedTime
  }, [get, openings])

  useFrame(({ clock }) => {
    const start = swingStart.current
    if (start === null || !lid.current || !rise.current) return
    // Over one second, with a cosine ease
    const t = Math.min(clock.elapsedTime - start, 1)
    const ease = 0.5 - Math.cos(Math.PI * t) / 2
    lid.current.rotation.x = -0.6 * Math.PI * ease
    rise.current.position.y = ease * size
    if (t === 1) swingStart.current = null
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    open(index)
  }

  return (
    <group position={[x, half, z]} onClick={onClick}>
      <group ref={sides}>
        {/* Bottom, back, front, right and left */}
        <mesh position-y={-half + 0.03} rotation-x={Math.PI / 2} castShadow receiveShadow />
        <mesh position-z={-half} rotation-x={Math.PI} castShadow receiveShadow />
        <mesh position-z={half} castShadow receiveShadow />
        <mesh position-x={half} rotation-y={Math.PI / 2} castShadow receiveShadow />
        <mesh position-x={-half} rotation-y={-Math.PI / 2} castShadow receiveShadow />
        {/* The lid, hinged at the top back edge */}
        <group ref={lid} position={[0, half, -half]}>
          <mesh position-z={half} rotation-x={-Math.PI / 2} castShadow receiveShadow />
        </group>
      </group>
      <group ref={rise}>
        <Prize text={prize} />
      </group>
    </group>
  )
}
