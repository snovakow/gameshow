import { CameraControlsImpl } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { folder, useControls } from 'leva'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import type { Phase } from '../game/director.ts'
import type { LineKey } from '../game/script.ts'
import { useGame, type Awaiting } from '../store.ts'
import { framedPosition, lookAt } from './useFraming.ts'

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

interface Screen {
  width: number
  height: number
}

interface Glides {
  takeOver: () => void
  refit: (screen: Screen) => void
}

// The point of the show a return home belongs to, so one held off by a gesture is dropped once the
// show has moved past it
interface Moment {
  round: number
  phase: Phase
  awaiting: Awaiting
}

// Takes the camera home to the framed view whenever the show needs the stage: as the host explains
// the rules, when a pick or a decision is awaited, as she announces a crate she or the player is
// about to open, and at the reveal and a loss. It glides there, and the player always wins: any
// gesture ends the glide where the camera is, and a moment that comes while a gesture is held
// waits for its release. Returns what ends a glide for the gestures the controls don't announce
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
    // Where the glide under way is headed, if one is
    const heading = new Vector3()
    let gliding = false
    let held = false
    let waiting: Moment | null = null

    // For the screen at its size now. A glide already headed home goes on as it is, unless the
    // screen has changed under it
    const goHome = (screen: Screen, refit = false) => {
      const { camera } = get()
      if (!(camera instanceof PerspectiveCamera)) return
      const { maxDistance } = cameraControls
      const framed = framedPosition(crates, camera.fov, screen.width, screen.height, maxDistance)
      if (gliding && !refit && heading.distanceTo(framed) < home) return
      cameraControls.getPosition(position, false)
      cameraControls.getTarget(target, false)
      if (!gliding && position.distanceTo(framed) < home && target.distanceTo(lookAt) < home) return
      heading.copy(framed)
      gliding = true
      cameraControls.smoothTime = panel('glide')
      const { x, y, z } = framed
      void cameraControls.setLookAt(x, y, z, lookAt.x, lookAt.y, lookAt.z, true)
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
      goHome(get().size)
    }

    const unsubscribe = useGame.subscribe((state, previous) => {
      const awaited =
        state.awaiting !== previous.awaiting &&
        (state.awaiting === 'pick' || state.awaiting === 'decision')
      const cued =
        state.cue !== previous.cue && (state.cue?.name === 'reveal' || state.cue?.name === 'lose')
      const said = state.line !== previous.line && !!state.line && homeLines.has(state.line.key)
      if (!awaited && !cued && !said) return
      if (held || cameraControls.currentAction !== ACTION.NONE) {
        waiting = { round: state.round, phase: state.phase, awaiting: state.awaiting }
        return
      }
      goHome(get().size)
    })
    cameraControls.addEventListener('rest', onRest)
    cameraControls.addEventListener('controlstart', onStart)
    cameraControls.addEventListener('controlend', onEnd)
    // A glide under way when the screen turns or resizes heads for the new screen's framed view,
    // since the framing has just refitted the distance along the way the camera faced mid-glide
    glides.current = {
      takeOver,
      refit: (screen) => {
        if (gliding) goHome(screen, true)
      },
    }
    return () => {
      unsubscribe()
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
