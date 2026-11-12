import type { VolumeNodeMaterial } from 'three/webgpu'
import { create } from 'zustand'

// The layer the light beams' haze is drawn on, and which the spots that light it join while the
// beams are on. The stage's own view draws layer 0 alone, so it never draws the haze, and the
// beams' own pass draws this one alone
export const beamLayer = 10

interface BeamVolume {
  // The haze's material while the light beams are showing, for the render pipeline to draw by
  // its own pass and to stop at whatever the stage's view has drawn in front of it
  material: VolumeNodeMaterial | null
}

export const useBeamVolume = create<BeamVolume>(() => ({ material: null }))
