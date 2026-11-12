import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CueName } from '../../game/director.ts'
import { useGame } from '../../store.ts'

export interface CelebrationHandlers {
  // A cue as the show sends it, with the crate the player finally chose, if any
  onCue: (name: CueName, final: number | null) => void
  // The show went back to its title card, so whatever is still celebrating stops
  onReset: () => void
}

// Hands each of the show's cues to a celebration once, as it comes. It listens to the store rather
// than rendering on it, since the show sends some cues together (a reveal and its win) and a
// render would see only the last. A cue already there at mount is the past, so a remount
// (StrictMode's second run among them, or a switch turned on) never replays one
export function useCelebrationCues(handlers: CelebrationHandlers) {
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    let heard = useGame.getState().cue?.id ?? null
    return useGame.subscribe((state, previous) => {
      const { cue } = state
      if (cue && cue.id !== heard) {
        heard = cue.id
        latest.current.onCue(cue.name, state.final)
      }
      if (state.phase === 'title' && previous.phase !== 'title') latest.current.onReset()
    })
  }, [])
}
