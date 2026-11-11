import { useLoader, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Box3, SkinnedMesh, Vector3, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useGame } from '../store.ts'
import { bodyHitTest } from './bodyHit.ts'
import { hostBox } from './useFraming.ts'
import { useHostAnimations } from './useHostAnimations.ts'
import { usePressTravel } from './usePressTravel.ts'

const ignoreRays = () => undefined

// Her standing pose's box on the stage, the one the framing fits, which takes presses in her place
const stand = new Box3(hostBox.min, hostBox.max)
const standSize = stand.getSize(new Vector3()).toArray()
const standCentre = stand.getCenter(new Vector3()).toArray()

export function Host() {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/gltf/Michelle.glb`)
  const root = useRef<Object3D>(null)

  // Loaded models are cached and shared, so the host is a clone, set up before anything uses it.
  // She takes no rays: three tests a ray against a skinned mesh by moving the corners of every
  // triangle through her bones, which held a phone for a third of a second at every finger put
  // down near her. Her body is tested only where a tap needs it, by a test that moves each vertex
  // once
  const { model, hitsBody } = useMemo(() => {
    const host = clone(gltf.scene)
    const meshes: SkinnedMesh[] = []
    host.traverse((object) => {
      if (object instanceof SkinnedMesh) {
        object.castShadow = true
        object.receiveShadow = true
        object.raycast = ignoreRays
        meshes.push(object)
      }
    })
    return { model: host, hitsBody: bodyHitTest(meshes) }
  }, [gltf])

  useHostAnimations(root)
  const { onPointerDown, isTap } = usePressTravel()

  // A press on her stops here, so it never opens a crate behind her. A tap that would pick or
  // decide on a crate showing behind her box, beside her neck or under an arm, is tested against
  // her body as she stands, and goes on to the crate where it misses her. A drag, a press out of
  // turn or one with no crate behind stops untested
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const tap = isTap()
    const { awaiting } = useGame.getState()
    const takesCrate = awaiting === 'pick' || awaiting === 'decision'
    const crateBehind = e.intersections.some(
      (hit) => hit.distance > e.distance && 'crate' in hit.eventObject.userData,
    )
    if (tap && takesCrate && crateBehind && !hitsBody(e.ray)) return
    e.stopPropagation()
  }

  return (
    <>
      <primitive ref={root} object={model} rotation-x={-Math.PI / 2} position-z={1} />
      {/* Twelve triangles to test where her body has 28,106. Hidden, it draws nothing and casts
          no shadow, but rays are tested against an object's layers, not its visibility, so it
          still takes presses */}
      <mesh
        position={standCentre}
        visible={false}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <boxGeometry args={standSize} />
      </mesh>
    </>
  )
}
