import { Canvas, type CameraProps, type Dpr } from '@react-three/fiber'
import { useEffect } from 'react'
import { WebGPURenderer } from 'three/webgpu'
import { Hud } from './hud/Hud.tsx'
import { Stage } from './stage/Stage.tsx'
import { useGame } from './store.ts'

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
  // A show runs from the Start click until it ends, Play again stops it, or the page goes
  useEffect(() => () => useGame.getState().stop(), [])

  return (
    <>
      <Canvas gl={createRenderer} camera={camera} flat shadows="percentage" dpr={dpr}>
        <Stage />
      </Canvas>
      {/* Beside the canvas, not in it, so a press on a button never reaches the stage */}
      <Hud />
    </>
  )
}

export default App
