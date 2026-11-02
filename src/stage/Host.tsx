import { useLoader, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { SkinnedMesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useHostAnimations } from './useHostAnimations.ts'

export function Host() {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/gltf/Michelle.glb`)
  const root = useRef<Object3D>(null)

  // Loaded models are cached and shared, so the host is a clone, set up before anything uses it
  const model = useMemo(() => {
    const host = clone(gltf.scene)
    host.traverse((object) => {
      if (object instanceof SkinnedMesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    return host
  }, [gltf])

  useHostAnimations(root)

  // Blocks clicks, so one on the host never opens a crate behind it
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
  }

  return (
    <primitive
      ref={root}
      object={model}
      rotation-x={-Math.PI / 2}
      position-z={1}
      onClick={onClick}
    />
  )
}
