import type { FnNode, ProxiedTuple } from 'three/src/nodes/tsl/TSLCore.js'
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

declare module 'three/src/lights/SpotLight.js' {
  interface SpotLight {
    // A pattern the spot projects, like a gobo, from the light's own coordinates of the point it
    // lights (its x and y run 0 to 1 across the cone), which tints the light's colour. A TSL Fn,
    // since the renderer also asks it for its cache key
    colorNode?: FnNode<ProxiedTuple<[Node<'vec3'>]>, Node<'vec3'>> | null
  }
}
