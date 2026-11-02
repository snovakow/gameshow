import { useLoader, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Mesh } from 'three'
import { reflector, texture, uv } from 'three/tsl'
import { MeshPhongNodeMaterial } from 'three/webgpu'

const textures = `${import.meta.env.BASE_URL}textures/floors/`

export function Floor() {
  const [diffuse, normal] = useLoader(TextureLoader, [
    `${textures}FloorsCheckerboard_S_Diffuse.jpg`,
    `${textures}FloorsCheckerboard_S_Normal.jpg`,
  ])
  const get = useThree((s) => s.get)
  const mesh = useRef<Mesh>(null)

  // A layout effect, so the floor has its material before the first frame draws it
  useLayoutEffect(() => {
    const { scene } = get()

    // Loaded textures are cached and shared, so the floor sets up its own copies
    const floorColor = diffuse.clone()
    floorColor.wrapS = RepeatWrapping
    floorColor.wrapT = RepeatWrapping
    floorColor.colorSpace = SRGBColorSpace

    const floorNormal = normal.clone()
    floorNormal.wrapS = RepeatWrapping
    floorNormal.wrapT = RepeatWrapping

    // The normal map doesn't light the floor; it ripples the reflection
    const floorUV = uv().mul(15)
    const floorNormalOffset = texture(floorNormal, floorUV).xy.mul(2).sub(1).mul(0.02)

    const reflection = reflector({ resolutionScale: 0.5 }) // half the render resolution
    reflection.target.rotateX(-Math.PI / 2)
    // Typed as nullable, but the reflector always starts with its screen-space UVs
    reflection.uvNode = reflection.uvNode!.add(floorNormalOffset)
    scene.add(reflection.target)

    const material = new MeshPhongNodeMaterial()
    material.colorNode = texture(floorColor, floorUV).add(reflection)
    if (mesh.current) mesh.current.material = material

    return () => {
      scene.remove(reflection.target)
      reflection.dispose()
      material.dispose()
      floorColor.dispose()
      floorNormal.dispose()
    }
  }, [get, diffuse, normal])

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[50, 50]} />
    </mesh>
  )
}
