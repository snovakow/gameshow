import type { HemisphereLight, SpotLight, Vector3 } from 'three'

// A light the show's cues may brighten, dim or move, with the brightness it rests at
export interface RigLight<L> {
  light: L
  rest: number
}

// The studio's lights as they stand now, for the cues to reach: StudioLights makes and remakes
// them in its effects as the switches change, and puts each here while it's in the scene. A cue
// changes a light's brightness, and a coloured spot's aim, from what is recorded here, and puts
// them back when it ends
export const lightRig = {
  fill: null as RigLight<HemisphereLight> | null,
  key: null as RigLight<SpotLight> | null,
  // In the crates' order, while the Spotlights switch is on
  crateSpots: [] as RigLight<SpotLight>[],
  // Each with where it points at rest
  colourSpots: [] as (RigLight<SpotLight> & { aim: Vector3 })[],
}
