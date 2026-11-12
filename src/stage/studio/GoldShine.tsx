import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { MeshStandardMaterial } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { PMREMGenerator, WebGPURenderer } from 'three/webgpu'
import { gold, grey, useMetals } from '../materials.ts'

// How much the room is blurred as it's prepared for reflection, as three's examples blur it
const roomBlur = 0.04
// Polished gold, and a duller metal for an empty crate
const goldRoughness = 0.25
const greyMetalness = 0.6
const greyRoughness = 0.4

// Gold that shines: while it's mounted, the prizes, the crates' numbers and the marquee's letters
// are metal reflecting a softly lit room. The room is the gold's own reflection, not the scene's
// environment, which would relight the host as well. Made from the renderer that draws it, which
// alone can use what it makes
export function GoldShine() {
  const get = useThree((s) => s.get)

  // A layout effect, so the frame the switch changes in draws with the new metals
  useLayoutEffect(() => {
    const { gl } = get()
    if (!(gl instanceof WebGPURenderer)) return undefined
    const generator = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const reflection = generator.fromScene(room, roomBlur)
    const shining = new MeshStandardMaterial({
      color: gold.color,
      metalness: 1,
      roughness: goldRoughness,
      envMap: reflection.texture,
    })
    const dull = new MeshStandardMaterial({
      color: grey.color,
      metalness: greyMetalness,
      roughness: greyRoughness,
      envMap: reflection.texture,
    })
    useMetals.setState({ gold: shining, grey: dull })
    return () => {
      useMetals.setState({ gold, grey })
      shining.dispose()
      dull.dispose()
      reflection.dispose()
      room.dispose()
      generator.dispose()
    }
  }, [get])

  return null
}
