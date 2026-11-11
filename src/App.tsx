import { Canvas, type CameraProps, type Dpr } from '@react-three/fiber'
import { Leva } from 'leva'
import { StrictMode, useEffect, useState } from 'react'
import { WebGPURenderer } from 'three/webgpu'
import { Hud } from './hud/Hud.tsx'
import { Stage } from './stage/Stage.tsx'
import { standardFov } from './stage/useFraming.ts'
import { useGame } from './store.ts'

const camera: CameraProps = { fov: standardFov, near: 0.25, far: 30, position: [1, 2, 4] }

// The device's pixel ratio, capped at 2: a phone at 3 would draw more than twice the pixels for
// a sharpness few can see
const dpr: Dpr = [0, 2]

// A phone either way up, where the open panel would cover most of the stage
const smallScreen = '(max-width: 600px), (max-height: 500px)'

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
  // Read once: the panel takes its starting state at mount, and a phone that turns keeps it
  const [collapsed] = useState(() => matchMedia(smallScreen).matches)

  return (
    <>
      {/* Ahead of every panel folder, so leva uses this panel rather than making one of its own;
          and outside StrictMode, whose second run of leva's own effects would fix the open
          panel's height before the stage adds its folders */}
      <Leva collapsed={collapsed} />
      <StrictMode>
        <Canvas gl={createRenderer} camera={camera} flat shadows="percentage" dpr={dpr}>
          <Stage />
        </Canvas>
        {/* Beside the canvas, not in it, so a press on a button never reaches the stage */}
        <Hud />
      </StrictMode>
    </>
  )
}

export default App
