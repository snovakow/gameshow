import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { color, normalWorldGeometry } from 'three/tsl'

const sky = 0x0487e2

export function Backdrop() {
  const get = useThree((s) => s.get)

  useEffect(() => {
    const { scene } = get()
    // A vertical gradient from sky blue to a deeper blue
    scene.backgroundNode = normalWorldGeometry.y.mix(color(sky), color(0x0066ff))
    return () => {
      scene.backgroundNode = null
    }
  }, [get])

  return <fog attach="fog" args={[sky, 7, 25]} />
}
