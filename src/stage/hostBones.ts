import type { Object3D } from 'three'

// The host's bones that the stage follows her by, which Host.tsx makes known once her model is
// loaded: her hips, which carry her across the stage as she dances
export const hostBones = {
  hips: null as Object3D | null,
}
