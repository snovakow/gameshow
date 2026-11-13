import { useLoader } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { SkinnedMesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useEffects } from './effects.ts'
import { places } from './layout.ts'
import { useHostAnimations } from './useHostAnimations.ts'

const ignoreRays = () => undefined

export function Host() {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/gltf/Michelle.glb`)
  const root = useRef<Object3D>(null)
  const standing = useEffects((s) => s.host)

  // Loaded models are cached and shared, so the host is a clone, set up before anything uses it.
  // She takes no presses: she stands behind the crates, so a press on her goes on to whatever lies
  // beyond, and three tests a ray against a skinned mesh by moving the corners of every triangle
  // through her bones, which held a phone for a third of a second at every finger put down near her
  const model = useMemo(() => {
    const host = clone(gltf.scene)
    host.traverse((object) => {
      if (object instanceof SkinnedMesh) {
        object.castShadow = true
        object.receiveShadow = true
        object.raycast = ignoreRays
      }
    })
    return host
  }, [gltf])

  useHostAnimations(root)

  const { hostSpot } = places[standing]
  return <primitive ref={root} object={model} rotation-x={-Math.PI / 2} position={hostSpot} />
}
