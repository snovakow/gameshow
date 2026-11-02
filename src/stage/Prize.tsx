import { useLoader } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { MeshPhongMaterial, type Mesh } from 'three'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'

const depth = 0.015

// One gold material, shared by every prize for the life of the page
const gold = new MeshPhongMaterial({ color: 0xffd700 })

export function Prize({ text }: { text: string }) {
  const font = useLoader(FontLoader, `${import.meta.env.BASE_URL}fonts/optimer_bold.typeface.json`)
  const mesh = useRef<Mesh>(null)

  useLayoutEffect(() => {
    const geometry = new TextGeometry(text, {
      font,
      size: 0.375,
      depth,
      curveSegments: 4,
      bevelEnabled: false,
    })
    geometry.computeBoundingBox()
    // Typed as nullable, but computeBoundingBox() has just set it
    const { min, max } = geometry.boundingBox!
    if (mesh.current) {
      mesh.current.geometry = geometry
      mesh.current.position.x = -(max.x - min.x) / 2
    }

    return () => {
      geometry.dispose()
    }
  }, [font, text])

  // Starts inside the crate; the crate raises it as the lid opens
  return (
    <mesh
      ref={mesh}
      material={gold}
      position-y={-0.1}
      position-z={-depth / 2}
      castShadow
      receiveShadow
    />
  )
}
