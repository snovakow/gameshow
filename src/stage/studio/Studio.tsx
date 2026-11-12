import { useEffects } from '../effects.ts'
import { GoldShine } from './GoldShine.tsx'
import { Haze } from './Haze.tsx'
import { Marquee } from './Marquee.tsx'
import { RingLight } from './RingLight.tsx'
import { Sky } from './Sky.tsx'
import { StudioFloor } from './StudioFloor.tsx'
import { StudioLights } from './StudioLights.tsx'

// The night studio: a dark sky, a floor that reflects the stage and fades into the night, rings of
// light across it, spotlights, a low haze, the show's title in lights and gold that shines, each
// of its extras switched in the panel
export function Studio({ crates }: { crates: [number, number][] }) {
  const rings = useEffects((s) => s.rings)
  const haze = useEffects((s) => s.haze)
  const marquee = useEffects((s) => s.marquee)
  const goldShine = useEffects((s) => s.goldShine)
  return (
    <>
      <Sky />
      <StudioFloor />
      <StudioLights crates={crates} />
      {rings && <RingLight />}
      {haze && <Haze />}
      {marquee && <Marquee />}
      {goldShine && <GoldShine />}
    </>
  )
}
