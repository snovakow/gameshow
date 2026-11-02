import { WebGPURenderer } from 'three/webgpu'

// R3F types its renderer as a WebGLRenderer, but the Canvas's factory makes a WebGPURenderer
export function asWebGPU(renderer: object): WebGPURenderer {
  if (!(renderer instanceof WebGPURenderer)) {
    throw new Error('Expected the WebGPURenderer the Canvas creates')
  }
  return renderer
}
