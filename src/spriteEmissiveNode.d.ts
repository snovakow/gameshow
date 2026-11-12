import type { Node } from 'three/webgpu'

// Every node material adds its emissiveNode to the light it gives and writes it where the bloom
// reads what shines (three r187's NodeMaterial.setupLighting), but @types/three 0.187 declares it
// on the lit materials alone. Sprites that shine, such as sparks and flames, set it too. The
// material's class is a default export, so its node properties, which it takes, gain it instead
declare module 'three/src/materials/nodes/SpriteNodeMaterial.js' {
  interface SpriteNodeMaterialNodeProperties {
    // What the sprite gives off, added to its colour and lighting the bloom
    emissiveNode?: Node<'vec3'> | null
  }
}
