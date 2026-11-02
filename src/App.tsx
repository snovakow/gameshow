import { Canvas, type CameraProps, type Dpr } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import { Stage } from './stage/Stage.tsx'

const camera: CameraProps = { fov: 50, near: 0.25, far: 30, position: [1, 2, 4] }

// The full device pixel ratio, uncapped, where R3F would cap it at 2
const dpr: Dpr = [0, Infinity]

async function createRenderer({ canvas }: { canvas: object }) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Gameshow renders to an HTML canvas')
  }
  const renderer = new WebGPURenderer({ canvas, antialias: true })
  await renderer.init()
  const backend = 'isWebGPUBackend' in renderer.backend ? 'WebGPU' : 'its WebGL 2 fallback'
  console.info(`Rendering with ${backend}`)
  return renderer
}

function App() {
  return (
    <Canvas gl={createRenderer} camera={camera} flat shadows="percentage" dpr={dpr}>
      <Stage />
    </Canvas>
  )
}

export default App
