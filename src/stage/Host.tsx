import { useLoader } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { SkinnedMesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useHostAnimations } from './useHostAnimations.ts'

const ignoreRays = () => undefined

export function Host() {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/gltf/Michelle.glb`)
  const root = useRef<Object3D>(null)

  // Loaded models are cached and shared, so the host is a clone, set up before anything uses it.
  // She takes no rays: a ray is tested against a skinned mesh's posed triangles on the CPU, which
  // held a phone for a third of a second at every finger put down near her, so she has no pointer
  // handler either, and a press on her reaches the stage behind her
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

  return <primitive ref={root} object={model} rotation-x={-Math.PI / 2} position-z={1} />
}
