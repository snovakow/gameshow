import { places, podium } from './layout.ts'
import { useMetals } from './materials.ts'

// A dark drum, so the host stands out against it, with a band of the stage's gold round its top
// edge, which shines in the studio as the crates' numbers do
const drum = 0x1c1b24
const shine = 40
// The band's height, and how far it stands proud of the drum's side so the two never fight for
// depth
const band = 0.06
const proud = 0.004

// The low round podium the host stands on behind the crates, just high enough that her feet show
// above the middle crate from the opening view as she stands, and wide enough to hold her feet
// through every dance
export function Podium() {
  const gold = useMetals((s) => s.gold)
  const { radius, height, sides } = podium
  const { hostSpot } = places.podium
  return (
    <group position={[hostSpot.x, 0, hostSpot.z]}>
      <mesh position-y={height / 2} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, sides]} />
        <meshPhongMaterial color={drum} shininess={shine} />
      </mesh>
      <mesh position-y={height - band / 2} material={gold} castShadow receiveShadow>
        <cylinderGeometry args={[radius + proud, radius + proud, band, sides, 1, true]} />
      </mesh>
    </group>
  )
}
