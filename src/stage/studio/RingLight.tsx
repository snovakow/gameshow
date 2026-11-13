import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { PointLight } from 'three'
import { rings } from './rings.ts'

// Low in front of the row, so it reaches the crates' faces and the host behind them; the floor,
// which it only grazes, carries the rings in its own material
const position = [0, 0.3, 1.7] as const
// The rings as a light at this strength, falling off with the square of the distance
const strength = 20

// The light that carries the floor's rings onto the crates and the host, after
// webgpu_reflection_blurred: its colour at each point it lights is the rings' pattern there
export function RingLight() {
  const get = useThree((s) => s.get)

  useLayoutEffect(() => {
    const { scene } = get()
    const light = new PointLight()
    // Read once, when the light is first drawn, so it's set before it joins the scene
    light.colorNode = rings.mul(strength)
    light.position.set(...position)
    scene.add(light)
    return () => {
      scene.remove(light)
      light.dispose()
    }
  }, [get])

  return null
}
