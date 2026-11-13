import { CameraControlsImpl } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { folder, useControls } from 'leva'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three'
import type { Phase } from '../game/director.ts'
import type { LineKey } from '../game/script.ts'
import { useGame, type Awaiting } from '../store.ts'
import { useEffects } from './effects.ts'
import { places } from './layout.ts'
import { framedPosition } from './useFraming.ts'

const { ACTION } = CameraControlsImpl

// camera-controls eases every change of view; at the shortest time it accepts, the ease is over
// within a frame, so the camera follows the pointer without lag
export const instant = 0.0001
// The glide home's ease, camera-controls' smoothTime in seconds, as the panel starts it. A move is
// at rest once every part of it is within 0.01 of its end, which at this ease comes within a second
// and a half of the start from any turn or zoom the player can make. The panel's range runs from
// nearly a jump to a slow drift
const glide = { value: 0.3, min: 0.1, max: 1, step: 0.05 }
// Nearer the framed view than this, in the stage's units, the camera is already home
const home = 1e-3
// The host's lines that want the stage in view: the rules, which are about the crates, and the
// two that announce a crate about to open, so the view is home before its lid moves
const homeLines = new Set<LineKey>(['rules', 'rulesSimple', 'hostOpens', 'open'])

// Where the camera can be sent: home to the framed view, back from it while a win is celebrated,
// or wide for the finale
type View = 'home' | 'celebrate' | 'finale'

// A win's view stands farther back along the framed view's line, as far as the host's place gives
// (layout.ts), so the confetti and the flames have room around the crates, and drifts there more
// slowly than the glide home starts
const pullBackGlide = 0.6
// The finale's view looks straight up the stage from the front, tilted this far from overhead, at
// the point the host's place gives it (layout.ts), from this much farther back than the framed
// view, and swings there slowly
const finaleTilt = MathUtils.degToRad(68)
const finaleWider = 1.5
const finaleGlide = 0.9

interface Screen {
  width: number
  height: number
}

interface Glides {
  takeOver: () => void
  refit: (screen: Screen) => void
}

// The point of the show a move belongs to, so one held off by a gesture is dropped once the show
// has moved past it
interface Moment {
  round: number
  phase: Phase
  awaiting: Awaiting
  view: View
}

// The move the show wants for a change of its state, if any. The returns home always; the win's
// and the finale's moves only with the Camera moves switch on
function viewFor(state: ReturnType<typeof useGame.getState>, previous: typeof state): View | null {
  const awaited =
    state.awaiting !== previous.awaiting &&
    (state.awaiting === 'pick' || state.awaiting === 'decision')
  const cue = state.cue !== previous.cue ? state.cue?.name : undefined
  const said = state.line !== previous.line && !!state.line && homeLines.has(state.line.key)
  if (awaited || said || cue === 'reveal' || cue === 'lose') return 'home'
  if (!useEffects.getState().cameraMoves) return null
  if (cue === 'win') return 'celebrate'
  if (cue === 'finale') return 'finale'
  return null
}

// Takes the camera home to the framed view whenever the show needs the stage: as the host explains
// the rules, when a pick or a decision is awaited, as she announces a crate she or the player is
// about to open, at the reveal and a loss, and when the host changes place, to frame her anew. With
// the Camera moves switch on, it also pulls back while a win is celebrated and swings wide for the
// finale. Each is a glide, one at a time, and the player always wins: any gesture ends the glide
// where the camera is, and a moment that comes while a gesture is held waits for its release.
// Returns what ends a glide for the gestures the controls don't announce
export function useHomeView(
  controls: RefObject<CameraControlsImpl | null>,
  crates: [number, number][],
) {
  const get = useThree((s) => s.get)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  // Set while the controls are mounted
  const glides = useRef<Glides | null>(null)
  // Read as each glide starts, so a change applies to the next one
  const [, , panel] = useControls(() => ({
    Camera: folder({
      glide: { ...glide, label: 'Glide home', hint: 'How slowly the view glides back' },
    }),
  }))

  useEffect(() => {
    const cameraControls = controls.current
    if (!cameraControls) return undefined
    const position = new Vector3()
    const target = new Vector3()
    // Where the glide under way is headed, if one is, and the view it's headed for
    const heading = new Vector3()
    const headingTarget = new Vector3()
    let view: View = 'home'
    let gliding = false
    let held = false
    let waiting: Moment | null = null
    const end = new Vector3()
    const endTarget = new Vector3()
    const offset = new Vector3()
    const spherical = new Spherical()

    // Where a view puts the camera and what it looks at, for a screen, into end and endTarget. Kept
    // within the limits the player's own moves keep to, which the controls apply to a drag or a
    // pan but not to a glide: looking down on the stage, at a point on or above the floor, within
    // the nearest and farthest distances. Otherwise the player's next drag would jump back to them
    const place = (to: View, screen: Screen, camera: PerspectiveCamera) => {
      const { minDistance, maxDistance, minPolarAngle, maxPolarAngle } = cameraControls
      const stage = places[useEffects.getState().host]
      const { lookAt } = stage
      const { fov } = camera
      const framed = framedPosition(crates, fov, screen.width, screen.height, maxDistance, stage)
      const distance = framed.distanceTo(lookAt)
      if (to === 'finale') {
        endTarget.copy(stage.finaleTarget)
        offset.setFromSphericalCoords(distance * finaleWider, finaleTilt, 0)
      } else {
        endTarget.copy(lookAt)
        offset.subVectors(framed, lookAt)
        if (to === 'celebrate') offset.multiplyScalar(stage.pullBack)
      }
      endTarget.y = Math.max(endTarget.y, 0)
      spherical.setFromVector3(offset)
      spherical.phi = MathUtils.clamp(spherical.phi, minPolarAngle, maxPolarAngle)
      spherical.radius = MathUtils.clamp(spherical.radius, minDistance, maxDistance)
      end.setFromSpherical(spherical).add(endTarget)
    }

    // For the screen at its size now. A glide already headed for the same place goes on as it is,
    // unless the screen has changed under it
    const glideTo = (to: View, screen: Screen, refit = false) => {
      const { camera } = get()
      if (!(camera instanceof PerspectiveCamera)) return
      place(to, screen, camera)
      const same = heading.distanceTo(end) < home && headingTarget.distanceTo(endTarget) < home
      if (gliding && !refit && same) return
      cameraControls.getPosition(position, false)
      cameraControls.getTarget(target, false)
      const there = position.distanceTo(end) < home && target.distanceTo(endTarget) < home
      if (!gliding && there) return
      heading.copy(end)
      headingTarget.copy(endTarget)
      view = to
      gliding = true
      cameraControls.smoothTime =
        to === 'home' ? panel('glide') : to === 'celebrate' ? pullBackGlide : finaleGlide
      const { x, y, z } = endTarget
      void cameraControls.setLookAt(end.x, end.y, end.z, x, y, z, true)
      // The camera's turn is counted on past a full circle, so it would unwind every turn the
      // player made; this takes the shorter way round instead
      cameraControls.normalizeRotations()
    }

    // Holds the camera where it is now, rather than where the glide was headed
    const takeOver = () => {
      if (!gliding) return
      gliding = false
      cameraControls.smoothTime = instant
      cameraControls.getPosition(position, false)
      cameraControls.getTarget(target, false)
      const { x, y, z } = position
      void cameraControls.setLookAt(x, y, z, target.x, target.y, target.z, false)
    }

    const onRest = () => {
      if (!gliding) return
      gliding = false
      cameraControls.smoothTime = instant
    }
    const onStart = () => {
      held = true
      takeOver()
    }
    const onEnd = () => {
      held = false
      const moment = waiting
      waiting = null
      if (!moment) return
      const { round, phase, awaiting } = useGame.getState()
      if (round !== moment.round || phase !== moment.phase || awaiting !== moment.awaiting) return
      glideTo(moment.view, get().size)
    }

    const unsubscribe = useGame.subscribe((state, previous) => {
      const to = viewFor(state, previous)
      if (!to) return
      if (held || cameraControls.currentAction !== ACTION.NONE) {
        waiting = { round: state.round, phase: state.phase, awaiting: state.awaiting, view: to }
        return
      }
      glideTo(to, get().size)
    })
    // The host changing place moves what the framed view holds, so the view glides home to hers,
    // after any gesture held, as the show's own returns do
    const unsubscribeHost = useEffects.subscribe((state, previous) => {
      if (state.host === previous.host) return
      if (held || cameraControls.currentAction !== ACTION.NONE) {
        const { round, phase, awaiting } = useGame.getState()
        waiting = { round, phase, awaiting, view: 'home' }
        return
      }
      glideTo('home', get().size)
    })
    cameraControls.addEventListener('rest', onRest)
    cameraControls.addEventListener('controlstart', onStart)
    cameraControls.addEventListener('controlend', onEnd)
    // A glide under way when the screen turns or resizes heads for its view on the new screen,
    // since the framing has just refitted the distance along the way the camera faced mid-glide
    glides.current = {
      takeOver,
      refit: (screen) => {
        if (gliding) glideTo(view, screen, true)
      },
    }
    return () => {
      unsubscribe()
      unsubscribeHost()
      cameraControls.removeEventListener('rest', onRest)
      cameraControls.removeEventListener('controlstart', onStart)
      cameraControls.removeEventListener('controlend', onEnd)
      glides.current = null
      takeOver()
    }
  }, [controls, crates, get, panel])

  useEffect(() => {
    glides.current?.refit({ width, height })
  }, [width, height])

  return useCallback(() => glides.current?.takeOver(), [])
}
