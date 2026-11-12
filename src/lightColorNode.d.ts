import type { Node } from 'three/webgpu'

// three's WebGPU renderer reads a colorNode on a light, which its types leave out (@types/three
// 0.187). A point light's is read once, when the renderer makes the light's node, so it's set
// before the light is first drawn and never swapped
declare module 'three/src/lights/PointLight.js' {
  interface PointLight {
    // Replaces the light's colour times its intensity, as seen from each point it lights
    colorNode?: Node<'vec3'> | null
  }
}
