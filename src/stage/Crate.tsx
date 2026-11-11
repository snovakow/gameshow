import { useCursor } from '@react-three/drei'
import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DoubleSide, Mesh, MeshPhongMaterial, PlaneGeometry, TextureLoader, type Group } from 'three'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { useGame } from '../store.ts'
import { fontUrl, gold } from './materials.ts'
import { Prize } from './Prize.tsx'

const size = 0.75
const half = size / 2
// How far the open lid swings back; the prize rises a crate's height with it
const openAngle = -0.6 * Math.PI
// A press whose pointer strays further than this, in CSS pixels, is a drag to look around and
// not a pick. R3F's own click distance is only the straight line from the press to the release,
// so a drag out and back would pass it
const maxTravel = 6

// The lid's swing: where it is (0 shut, 1 open), and where the current swing started
interface Swing {
  progress: number
  from: number
  target: number
  start: number
}

// The crate's number on its front, in gold, as the player sees it, from 1
function CrateNumber({ number }: { number: number }) {
  const font = useLoader(FontLoader, fontUrl)
  const mesh = useRef<Mesh>(null)

  useLayoutEffect(() => {
    const geometry = new TextGeometry(String(number), {
      font,
      size: 0.3,
      depth: 0.01,
      curveSegments: 4,
      bevelEnabled: false,
    })
    geometry.computeBoundingBox()
    // Typed as nullable, but computeBoundingBox() has just set it
    const { min, max } = geometry.boundingBox!
    geometry.translate(-(min.x + max.x) / 2, -(min.y + max.y) / 2, 0)
    if (mesh.current) mesh.current.geometry = geometry
    return () => {
      geometry.dispose()
    }
  }, [font, number])

  // Just proud of the front, so it never fights the crate's face for depth
  return <mesh ref={mesh} material={gold} position-z={half + 0.001} />
}

export function Crate({ index, x, z }: { index: number; x: number; z: number }) {
  const crate = useLoader(TextureLoader, `${import.meta.env.BASE_URL}textures/crate.gif`)
  const text = useGame((s) => s.crates[index].text)
  const kind = useGame((s) => s.crates[index].kind)
  // The ring follows the player's current choice: the pick, then the final crate
  const chosen = useGame((s) => (s.final ?? s.picked) === index)
  const clickable = useGame(
    (s) => s.awaiting === 'pick' || (s.awaiting === 'decision' && s.opened !== index),
  )
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && clickable)

  const sides = useRef<Group>(null)
  const lid = useRef<Group>(null)
  const rise = useRef<Group>(null)
  const swing = useRef<Swing>({ progress: 0, from: 0, target: 0, start: 0 })
  // How far the current press has strayed, or null when no press began on this crate
  const travel = useRef<number | null>(null)
  const stopTracking = useRef<(() => void) | null>(null)

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

  useEffect(
    () => () => {
      stopTracking.current?.()
    },
    [],
  )

  useFrame(({ clock }) => {
    const { open, shut } = useGame.getState().crates[index]
    const s = swing.current
    const target = open ? 1 : 0
    const now = clock.elapsedTime
    // A new target eases from wherever the lid is now
    if (target !== s.target) {
      s.from = s.progress
      s.target = target
      s.start = now
    }
    if (s.progress !== s.target && lid.current && rise.current) {
      // Over one second, with a cosine ease
      const t = Math.min(now - s.start, 1)
      const ease = 0.5 - Math.cos(Math.PI * t) / 2
      s.progress = t === 1 ? s.target : s.from + (s.target - s.from) * ease
      lid.current.rotation.x = openAngle * s.progress
      rise.current.position.y = s.progress * size
    }
    // Reported once the lid is down, so the show changes no text while a lid is open
    if (!open && !shut && s.progress === 0) useGame.getState().reportShut(index)
  })

  // The press is tracked on the window for its whole length, since the pointer may leave the
  // crate and come back before it's released
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    stopTracking.current?.()
    const { pointerId, clientX, clientY } = e.nativeEvent
    travel.current = 0
    const stray = (event: PointerEvent) => {
      const distance = Math.hypot(event.clientX - clientX, event.clientY - clientY)
      travel.current = Math.max(travel.current ?? 0, distance)
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerId === pointerId) stray(event)
    }
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      stray(event)
      stop()
    }
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      travel.current = null
      stop()
    }
    const stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      stopTracking.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    stopTracking.current = stop
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const strayed = travel.current
    travel.current = null
    if (strayed === null || strayed > maxTravel) return
    // The store ignores whichever isn't the player's turn
    const game = useGame.getState()
    if (game.awaiting === 'pick') game.pick(index)
    else if (game.awaiting === 'decision') game.decide(index)
  }

  return (
    <group
      position={[x, half, z]}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
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
      <CrateNumber number={index + 1} />
      <group ref={rise}>
        <Prize text={text} kind={kind} />
      </group>
      {/* The pick, marked on the floor; unlit, so it reads the same under any light. Hidden
          meshes still take rays, so it never takes one, and a press on the floor beside a crate
          stays a press on the floor */}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={-half + 0.004}
        visible={chosen}
        raycast={() => null}
      >
        <ringGeometry args={[0.6, 0.68, 64]} />
        <meshBasicMaterial color={0xffd700} />
      </mesh>
    </group>
  )
}
