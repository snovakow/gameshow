import type { CameraControlsImpl } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'

// The opening view the stage has always had: from (1, 2, 4), looking at a point half a unit above
// the middle of the floor
const opening = new Vector3(1, 2, 4)
const lookAt = new Vector3(0, 0.5, 0)
// The framing never brings the camera nearer than the opening view, so a screen as wide as a
// desktop's keeps exactly that view
const nearest = opening.distanceTo(lookAt)
// Everything framed stays within 95% of the view's half-width and half-height from its middle
const reach = 0.95

// The lens's vertical angle, in degrees, on most screens
export const standardFov = 50
// The narrowest screen the standard lens frames well, a tablet held upright at 820 by 1180, about
// 35.9° across. A narrower screen, a phone held upright, widens the lens until it sees as far
// across, rather than standing the camera back to near its limit
const narrowestAspect = 820 / 1180

// The lens for a screen's shape: the standard one, or wider on a screen narrower than the tablet's
function fovFor(aspect: number) {
  if (aspect >= narrowestAspect) return standardFov
  const across = Math.tan(MathUtils.degToRad(standardFov) / 2) * narrowestAspect
  return MathUtils.radToDeg(2 * Math.atan(across / aspect))
}

// What the fit holds besides the crates, which are 0.75 on a side as Crate.tsx builds them: the
// pick's ring on the floor around each, as Crate.tsx draws it, whose outer edge is the corners of
// a 64-sided polygon 0.68 from the crate's middle; the host idling on her spot, measured from her
// model, whose hair reaches 1.67; and the bubble's anchor, where SpeechBubble.tsx pins it above
// her spot
const crateSize = 0.75
const ring = { radius: 0.68, sides: 64, height: 0.004 }
const host = { min: new Vector3(-0.3, 0, 0.82), max: new Vector3(0.26, 1.67, 1.27) }
const bubbleAnchor = new Vector3(0, 1.9, 1)
// The bubble at its largest, in CSS pixels, as index.css lays it out and SpeechBubble.tsx
// centres it on its anchor: 260 wide and four lines of 15 px at 1.3, each with its padding,
// and the tail below
const bubble = { width: 284, height: 94, tail: 8 }

function corners(min: Vector3, max: Vector3) {
  const points: Vector3[] = []
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y])
      for (const z of [min.z, max.z]) points.push(new Vector3(x, y, z))
  return points
}

// The points that must show: every corner of each closed crate, of its ring and of the host's
// box. The ring shows on one crate at a time, but any of them may be picked
function framedPoints(crates: [number, number][]) {
  const half = crateSize / 2
  const points = crates.flatMap(([x, z]) =>
    corners(new Vector3(x - half, 0, z - half), new Vector3(x + half, crateSize, z + half)),
  )
  const { radius, sides, height } = ring
  for (const [x, z] of crates) {
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * 2 * Math.PI
      points.push(new Vector3(x + radius * Math.cos(angle), height, z + radius * Math.sin(angle)))
    }
  }
  return [...points, ...corners(host.min, host.max)]
}

// How far back the camera must stand for a point to fit on one side of the view, given how far
// the point already sits toward the camera, its offset to that side, and the room the view leaves
// there as a tangent: as far as allowed when there's no room at all, as for a bubble wider than
// the screen
function standBack(along: number, offset: number, room: number) {
  if (room <= 0) return Infinity
  return offset > 0 ? along + offset / room : along
}

// The distance from the centre, along the direction, at which every point and the bubble fit the
// view with the margin. Each bound is exact rather than searched for: with the camera at distance
// d, a point sits d - along in front of it, and its offset over that depth is the tangent the view
// must hold
function fitDistance(
  points: Vector3[],
  centre: Vector3,
  direction: Vector3,
  fov: number,
  width: number,
  height: number,
) {
  // The camera's axes, as its lookAt builds them with the world's up
  const right = new Vector3(0, 1, 0).cross(direction).normalize()
  const up = new Vector3().crossVectors(direction, right)
  const tall = Math.tan(MathUtils.degToRad(fov) / 2)
  const wide = tall * (width / height)
  const offset = new Vector3()
  let distance = 0
  for (const point of points) {
    offset.subVectors(point, centre)
    const along = offset.dot(direction)
    const x = offset.dot(right)
    const y = offset.dot(up)
    distance = Math.max(
      distance,
      standBack(along, x, reach * wide),
      standBack(along, -x, reach * wide),
      standBack(along, y, reach * tall),
      standBack(along, -y, reach * tall),
    )
  }
  // The bubble keeps its size on screen, so its anchor has that much less room, in the view's
  // own units (the view spans 2 across and 2 high)
  offset.subVectors(bubbleAnchor, centre)
  const along = offset.dot(direction)
  const x = offset.dot(right)
  const y = offset.dot(up)
  const across = (reach - bubble.width / width) * wide
  return Math.max(
    distance,
    standBack(along, x, across),
    standBack(along, -x, across),
    standBack(along, y, (reach - bubble.height / height) * tall),
    standBack(along, -y, (reach - (bubble.height + 2 * bubble.tail) / height) * tall),
  )
}

// Fits the stage to the screen: the closed crates with their rings, the host and her bubble, with
// a margin, through a lens widened on a screen held upright. At the opening it looks along the
// stage's opening line of sight; after a resize or a turn of the phone it keeps the direction the
// player has turned to and refits only the distance
export function useFraming(
  controls: RefObject<CameraControlsImpl | null>,
  crates: [number, number][],
) {
  const get = useThree((s) => s.get)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  // Until the opening view is set, the controls look at the origin, not along the stage's line
  const opened = useRef(false)

  // A layout effect, so the first frame that draws the stage already draws it framed
  useLayoutEffect(() => {
    const cameraControls = controls.current
    const { camera } = get()
    if (!cameraControls || !(camera instanceof PerspectiveCamera)) return
    // The lens first, since the fit depends on how much it sees
    const fov = fovFor(width / height)
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    const points = framedPoints(crates)
    if (!opened.current) {
      const direction = opening.clone().sub(lookAt).normalize()
      const fitted = fitDistance(points, lookAt, direction, camera.fov, width, height)
      const distance = MathUtils.clamp(fitted, nearest, cameraControls.maxDistance)
      const position = direction.multiplyScalar(distance).add(lookAt)
      void cameraControls.setLookAt(
        position.x,
        position.y,
        position.z,
        lookAt.x,
        lookAt.y,
        lookAt.z,
        false,
      )
      opened.current = true
      return
    }
    const centre = cameraControls.getTarget(new Vector3())
    const direction = cameraControls.getPosition(new Vector3()).sub(centre).normalize()
    const fitted = fitDistance(points, centre, direction, camera.fov, width, height)
    void cameraControls.dollyTo(MathUtils.clamp(fitted, nearest, cameraControls.maxDistance), false)
  }, [controls, crates, get, width, height])
}
