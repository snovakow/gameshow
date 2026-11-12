import { useEffects } from '../effects.ts'
import { Confetti } from './Confetti.tsx'
import { Fireworks } from './Fireworks.tsx'

// The show's celebrations, each switched in the panel: confetti for a win and the finale, and
// fireworks at the finale. They play in either look, since they belong to the show rather than
// the studio
export function Celebrations({ crates }: { crates: [number, number][] }) {
  const confetti = useEffects((s) => s.confetti)
  const fireworks = useEffects((s) => s.fireworks)
  return (
    <>
      {confetti && <Confetti crates={crates} />}
      {fireworks && <Fireworks />}
    </>
  )
}
