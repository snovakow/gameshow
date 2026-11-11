import { useLoader } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import type { Mesh } from 'three'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import type { CrateKind } from '../game/director.ts'
import { fontUrl, gold, grey } from './materials.ts'

const depth = 0.015
// Wider text than this scales down, so a large amount still fits over its crate
const maxWidth = 1.2

export function Prize({ text, kind }: { text: string; kind: CrateKind }) {
  const font = useLoader(FontLoader, fontUrl)
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
    const scale = Math.min(1, maxWidth / (max.x - min.x))
    if (mesh.current) {
      mesh.current.geometry = geometry
      mesh.current.scale.set(scale, scale, 1)
      // Centred on the glyphs themselves, which start a little right of the origin
      mesh.current.position.x = (-(min.x + max.x) / 2) * scale
    }

    return () => {
      geometry.dispose()
    }
  }, [font, text])

  // Starts inside the crate; the crate raises it as the lid opens
  return (
    <mesh
      ref={mesh}
      material={kind === 'prize' ? gold : grey}
      position-y={-0.1}
      position-z={-depth / 2}
      castShadow
      receiveShadow
    />
  )
}
