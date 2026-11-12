import { folder, useControls } from 'leva'
import { useEffect } from 'react'
import { useGame } from '../store.ts'
import { loadSounds, playCue, stopAll, useSound } from './sounds.ts'

// Plays the show's cues, each once. It listens to the store rather than rendering on it, since
// the show sends some cues together (a reveal and its win) and a render would see only the last.
// A cue already there when it mounts is the past, so a remount (StrictMode's second run among
// them) never replays one
export function useSoundCues() {
  useEffect(() => {
    void loadSounds()
    let heard = useGame.getState().cue?.id ?? null
    return useGame.subscribe((state, previous) => {
      const { cue } = state
      if (cue && cue.id !== heard) {
        heard = cue.id
        playCue(cue.name)
      }
      if (state.phase === 'title' && previous.phase !== 'title') stopAll()
    })
  }, [])
}

const volume = { value: 1, min: 0, max: 1, step: 0.05 }

// The panel's Sound folder, a volume for each kind of sound, folded away at first and kept below
// the other folders, on a gift too
export function useSoundFolder() {
  const setVolume = useSound((s) => s.setVolume)
  const { crowd, stings, bed } = useControls({
    Sound: folder(
      {
        crowd: { ...volume, label: 'Crowd', hint: 'Applause, cheers, oohs and awws' },
        stings: { ...volume, label: 'Stings', hint: 'The drumroll and the crash' },
        bed: { ...volume, label: 'Murmur', hint: 'The audience murmuring under the show' },
      },
      { collapsed: true, order: 1 },
    ),
  })

  useEffect(() => setVolume('crowd', crowd), [setVolume, crowd])
  useEffect(() => setVolume('stings', stings), [setVolume, stings])
  useEffect(() => setVolume('bed', bed), [setVolume, bed])
}
