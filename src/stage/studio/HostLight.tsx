import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { MathUtils, SpotLight, Vector3 } from 'three'
import { useEffects } from '../effects.ts'
import { hostBones } from '../hostBones.ts'
import { places } from '../layout.ts'
import { lightRig } from './lightRig.ts'

// A follow spot on the host, high in front of the stage to the camera's left, the key light
// standing to its right, in the key's warm white. Narrow and soft, so it pools on her and round her
// feet and leaves the crates' fronts to their own spots, yet wide enough that its soft edge never
// reaches her while she dances, her arms and feet swinging out from her hips, which it follows a
// little behind
const follow = {
  colour: 0xfff1dc,
  position: [-1, 6, 2.5],
  angle: MathUtils.degToRad(15),
  penumbra: 0.3,
} as const
// Her brightness at the panel's Brightness of 1, falling off with the square of the distance:
// about 2.1 at her middle, 6.9 away, where the key light, aimed at the row, gives her about 1.4.
// Any brighter and the sheen of her top begins to burn out to white
const strength = 100
// It aims at her middle, this far above her spot
const middle = 0.85
// How quickly the aim catches up with her hips as she sways, as a rate: a fifth of a second's lag,
// so a dance's sway moves the pool smoothly rather than shaking it
const follows = 5

// The host's own light in the studio, following her as she dances. It casts no shadow, so the
// crate in front of her never cuts it, and stays off the light beams' layer, so it lights none of
// their haze and no cone is drawn for it. The show's cues dim it with the rest of the studio
export function HostLight() {
  const get = useThree((s) => s.get)
  const light = useRef<SpotLight | null>(null)
  const hips = useRef(new Vector3())

  useLayoutEffect(() => {
    const { scene } = get()
    const { host, hostLightBrightness } = useEffects.getState()
    const rest = strength * hostLightBrightness
    const spot = new SpotLight(follow.colour, rest, 0, follow.angle, follow.penumbra)
    spot.position.set(...follow.position)
    const { hostSpot } = places[host]
    spot.target.position.set(hostSpot.x, hostSpot.y + middle, hostSpot.z)
    scene.add(spot, spot.target)
    light.current = spot
    lightRig.host = { light: spot, rest }
    return () => {
      lightRig.host = null
      light.current = null
      scene.remove(spot, spot.target)
      spot.dispose()
    }
  }, [get])

  // The panel's Brightness sets where it rests, which the cues dim it from
  useEffect(
    () =>
      useEffects.subscribe((effects, before) => {
        if (effects.hostLightBrightness === before.hostLightBrightness || !lightRig.host) return
        lightRig.host.rest = strength * effects.hostLightBrightness
        lightRig.host.light.intensity = lightRig.host.rest
      }),
    [],
  )

  useFrame((_, delta) => {
    const spot = light.current
    if (!spot) return
    const { hostSpot } = places[useEffects.getState().host]
    const aim = spot.target.position
    const bone = hostBones.hips
    if (bone) bone.getWorldPosition(hips.current)
    else hips.current.copy(hostSpot)
    aim.x = MathUtils.damp(aim.x, hips.current.x, follows, delta)
    aim.z = MathUtils.damp(aim.z, hips.current.z, follows, delta)
    aim.y = hostSpot.y + middle
  })

  return null
}
