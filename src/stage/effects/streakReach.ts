import { useFrame } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { uniform } from 'three/tsl'
import { useEffects } from '../effects.ts'
import { places } from '../layout.ts'

// The streaks are gathered from what shines at this share of the picture's resolution, since their
// taps then reach four times as far for the same cost
export const streakScale = 0.25
// Each streak is gathered along its row by taps at most this many of those pixels apart: a bulb is
// two or three of them wide, and taps further apart step over it, beading the streak into dots
const widestSpacing = 2
// How far a streak runs either side of its light, as a length on the stage seen at the title's
// distance, so it grows on screen as the camera nears the title and shrinks with an upright
// screen's wider view, as the bulbs themselves do. The bulbs are on the title and the fireworks
// burst just in front of it, so their streaks follow the stage alike. At the desktop's opening view
// a streak runs 160 CSS pixels either side, as far as the streaks reached when their reach was a
// fixed count of pixels
const streakLength = 1.367
// The most taps either side of a light, four times the opening view's, past which a streak stops
// growing. The zoom's limit along the opening view needs half of them; only a view brought within
// a quarter of the opening view's distance of the title needs more. On a 2014 Intel Mac, up to
// this many the streaks cost no frame rate that could be told from a run's own spread, where 240
// cost 5% and 320 8%
const mostTaps = 160

// How many taps a streak gathers either side of its light, and how far apart they are, in the
// streaks' own pixels: set every frame here and read by the streaks' pass, so nothing it draws is
// rebuilt as they change
export const streakTaps = uniform(40)
export const streakSpacing = uniform(widestSpacing)

const toTitle = new Vector3()
const facing = new Vector3()

// Sets the streaks' reach for the frame from the camera's view of the title. Mounted by the
// pipeline while the streaks are switched on
export function StreakReach() {
  useFrame(({ camera, gl, size }) => {
    if (!(camera instanceof PerspectiveCamera)) return
    const { place } = places[useEffects.getState().host].marquee
    // The title's distance along the view, by which the lens shrinks whatever stands there
    const depth = toTitle.subVectors(place, camera.position).dot(camera.getWorldDirection(facing))
    const halfView = depth * Math.tan(MathUtils.degToRad(camera.fov) / 2)
    const cssPerUnit = (camera.zoom * size.height) / 2 / halfView
    // The streaks' pixels across the canvas, against its CSS pixels, so the reach on screen is the
    // same at any resolution
    const perCss = Math.floor(gl.domElement.width * streakScale) / size.width
    // With the title behind the camera, as far as the streaks go
    const reach = depth > 0 ? streakLength * cssPerUnit * perCss : Infinity
    const taps = Math.min(mostTaps, Math.ceil(reach / widestSpacing))
    streakTaps.value = Math.max(1, taps)
    streakSpacing.value = Math.min(widestSpacing, reach / streakTaps.value)
  })

  return null
}
