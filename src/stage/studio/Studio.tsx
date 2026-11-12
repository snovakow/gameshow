import { useEffects } from '../effects.ts'
import { RingLight } from './RingLight.tsx'
import { Sky } from './Sky.tsx'
import { StudioFloor } from './StudioFloor.tsx'

// The night studio: a dark sky, a floor that reflects the stage and fades into the night, and rings
// of light across it, each of its extras switched in the panel
export function Studio() {
  const rings = useEffects((s) => s.rings)
  return (
    <>
      <Sky />
      <StudioFloor />
      {rings && <RingLight />}
    </>
  )
}
