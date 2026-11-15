import { useFrame, useLoader } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { SkinnedMesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useGame } from '../store.ts'
import { useEffects } from './effects.ts'
import { hostBones } from './hostBones.ts'
import { places } from './layout.ts'
import { useHostAnimations } from './useHostAnimations.ts'

const ignoreRays = () => undefined

// Her hips' bone, as the loader names it: Mixamo's names hold a colon, which three's node names
// can't, so the loader drops it
const hipsBone = 'mixamorigHips'

const modelUrl = `${import.meta.env.BASE_URL}models/gltf/Michelle.glb`
// Start her model loading now, beside her clips, rather than once the rest of the stage is in: the
// title card counts it from the first, and she arrives sooner
useLoader.preload(GLTFLoader, modelUrl)

export function Host() {
  const gltf = useLoader(GLTFLoader, modelUrl)
  const root = useRef<Object3D>(null)
  const seen = useRef(false)
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

  // Her hips are made known to what follows her, such as her light in the studio
  useLayoutEffect(() => {
    const hips = model.getObjectByName(hipsBone) ?? null
    hostBones.hips = hips
    return () => {
      if (hostBones.hips === hips) hostBones.hips = null
    }
  }, [model])

  useHostAnimations(root)

  // Her first frame on stage, already in her stance, lets the show start: the frame this runs in
  // draws her, and the title card hears of it only after
  useFrame(() => {
    if (seen.current) return
    seen.current = true
    useGame.getState().reportHostOnStage()
  })

  const { hostSpot } = places[standing]
  return <primitive ref={root} object={model} rotation-x={-Math.PI / 2} position={hostSpot} />
}
