import { useEffects } from '../effects.ts'
import { CheapBeams, LightBeams } from '../effects/Beams.tsx'
import { LightCues } from '../effects/LightCues.tsx'
import { GoldShine } from './GoldShine.tsx'
import { Haze } from './Haze.tsx'
import { HostLight } from './HostLight.tsx'
import { Marquee } from './Marquee.tsx'
import { Sky } from './Sky.tsx'
import { StudioFloor } from './StudioFloor.tsx'
import { StudioLights } from './StudioLights.tsx'

// The night studio: a dark sky, a floor that reflects the stage and fades into the night,
// spotlights and their beams, a light of the host's own, a low haze, the show's title in lights and
// gold that shines, each of its extras switched in the panel, and its lights answering the show's
// moments
export function Studio({ crates }: { crates: [number, number][] }) {
  const hostLight = useEffects((s) => s.hostLight)
  const haze = useEffects((s) => s.haze)
  const marquee = useEffects((s) => s.marquee)
  const goldShine = useEffects((s) => s.goldShine)
  const lightCues = useEffects((s) => s.lightCues)
  const spotlights = useEffects((s) => s.spotlights)
  const cheapBeams = useEffects((s) => s.cheapBeams)
  const lightBeams = useEffects((s) => s.lightBeams)
  return (
    <>
      <Sky />
      <StudioFloor />
      <StudioLights crates={crates} />
      {hostLight && <HostLight />}
      {haze && <Haze />}
      {marquee && <Marquee />}
      {goldShine && <GoldShine />}
      {/* After the lights, so it finds them made */}
      {lightCues && <LightCues />}
      {/* The beams fall from the spots, so there are none without them; the light beams take the
          cones' place */}
      {spotlights && lightBeams && <LightBeams />}
      {spotlights && cheapBeams && !lightBeams && <CheapBeams />}
    </>
  )
}
