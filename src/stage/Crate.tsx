import { useCursor } from '@react-three/drei'
import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Color,
  DoubleSide,
  Mesh,
  MeshPhongMaterial,
  PlaneGeometry,
  TextureLoader,
  type Group,
} from 'three'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { useGame } from '../store.ts'
import { useEffects } from './effects.ts'
import { fontUrl, gold } from './materials.ts'
import { useOutlined } from './outlined.ts'
import { Prize } from './Prize.tsx'
import { usePressTravel } from './usePressTravel.ts'

const size = 0.75
const half = size / 2
// How far the open lid swings back; the prize rises a crate's height with it
const openAngle = -0.6 * Math.PI
// The warm light the chosen crate's sides give off where the bloom is on, dim enough that the
// wood still shows through it, and none otherwise
const glowColor = new Color(0xffb000).multiplyScalar(0.15)
const noGlow = new Color(0x000000)

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
  // With the outline on, it marks the crate under the pointer and the choice; without it, the ring
  // marks the choice, and where the bloom is on the chosen crate glows as well
  const outlineOn = useEffects((s) => s.outline)
  const bloomOn = useEffects((s) => s.bloom)
  const outlined = outlineOn && (chosen || (hovered && clickable))
  const glowing = chosen && bloomOn && !outlineOn
  const mark = useOutlined((s) => s.mark)

  const sides = useRef<Group>(null)
  const sidesMaterial = useRef<MeshPhongMaterial | null>(null)
  const lid = useRef<Group>(null)
  const rise = useRef<Group>(null)
  const swing = useRef<Swing>({ progress: 0, from: 0, target: 0, start: 0 })
  // A drag that starts on the crate looks around rather than picking it
  const { onPointerDown, isTap } = usePressTravel()

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
    sidesMaterial.current = material

    return () => {
      sidesMaterial.current = null
      geometry.dispose()
      material.dispose()
      map.dispose()
    }
  }, [crate])

  // Set in place: the renderer draws a node material copied from this one, which shares its colours
  // rather than copying them, so a change here reaches the frame without rebuilding the material.
  // Declared after the material's own effect, so it runs after it in the same commit
  useLayoutEffect(() => {
    sidesMaterial.current?.emissive.copy(glowing ? glowColor : noGlow)
  }, [glowing])

  useEffect(() => {
    const box = sides.current
    if (!outlined || !box) return undefined
    mark(box, true)
    return () => mark(box, false)
  }, [mark, outlined])

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
    // The prize is drawn only from the moment its lid starts to open until it's shut again: a wide
    // amount is broader than the crate, and would show through its sides, in its shadow and in the
    // floor's reflection, where the prize is before the player chooses
    if (rise.current) rise.current.visible = s.target === 1 || s.progress > 0
    // Reported once the lid is down, so the show changes no text while a lid is open
    if (!open && !shut && s.progress === 0) useGame.getState().reportShut(index)
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!isTap()) return
    // The store ignores whichever isn't the player's turn
    const game = useGame.getState()
    if (game.awaiting === 'pick') game.pick(index)
    else if (game.awaiting === 'decision') game.decide(index)
  }

  return (
    <group
      position={[x, half, z]}
      // Marks it as a crate to the host's box, which a tap may reach it through (Host.tsx)
      userData={{ crate: index }}
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
      {/* The pick, marked on the floor unless the outline marks it; unlit, so it reads the same
          under any light. Hidden meshes still take rays, so it never takes one, and a press on
          the floor beside a crate stays a press on the floor */}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={-half + 0.004}
        visible={chosen && !outlineOn}
        raycast={() => null}
      >
        <ringGeometry args={[0.6, 0.68, 64]} />
        <meshBasicMaterial color={0xffd700} />
      </mesh>
    </group>
  )
}
