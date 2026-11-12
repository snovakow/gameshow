import { Suspense } from 'react'
import { useEffects } from '../effects.ts'
import { Confetti } from './Confetti.tsx'
import { Fireworks } from './Fireworks.tsx'
import { Flames } from './Flames.tsx'

// The show's celebrations, each switched in the panel: confetti for a win and the finale,
// fireworks at the finale, and flame jets for a win. They play in either look, since they belong
// to the show rather than the studio
export function Celebrations({ crates }: { crates: [number, number][] }) {
  const confetti = useEffects((s) => s.confetti)
  const fireworks = useEffects((s) => s.fireworks)
  const flames = useEffects((s) => s.flames)
  return (
    <>
      {confetti && <Confetti crates={crates} />}
      {fireworks && <Fireworks />}
      {/* Its noise textures load when it's first switched on, without holding the stage up */}
      {flames && (
        <Suspense fallback={null}>
          <Flames />
        </Suspense>
      )}
    </>
  )
}
