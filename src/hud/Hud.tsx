import { useControls } from 'leva'
import { useEffect } from 'react'
import { useGame } from '../store.ts'
import { Tab } from './Tab.tsx'
import { TitleCard } from './TitleCard.tsx'

// A temporary panel folder for trying each game in the demo, applied at the next Start
function useGameFolder() {
  const setOptions = useGame((s) => s.setOptions)
  // Only its first value counts, as the panel reads its starting values once
  const options = useGame((s) => s.options)
  const { mode, prizes, rounds } = useControls('Game', {
    mode: {
      value: options.game,
      options: { 'Monty Hall': 'montyHall', Simple: 'simple' },
      label: 'Mode',
    },
    prizes: {
      value: options.prizes,
      options: { 'Pure odds': 'pureOdds', 'Within range': 'withinRange' },
      label: 'Prizes',
    },
    rounds: { value: options.rounds, min: 1, max: 10, step: 1, label: 'Rounds' },
  })

  useEffect(() => {
    setOptions({
      game: mode === 'simple' ? 'simple' : 'montyHall',
      prizes: prizes === 'withinRange' ? 'withinRange' : 'pureOdds',
      rounds,
    })
  }, [setOptions, mode, prizes, rounds])
}

// The title card, the tab and the show's buttons, drawn over the canvas and outside its events:
// the tab a corner in landscape and a strip above the buttons in portrait, all of it clear of the
// frame-rate meter, the panel and the screen's notch and home bar
export function Hud() {
  useGameFolder()
  const phase = useGame((s) => s.phase)
  const awaiting = useGame((s) => s.awaiting)
  const over = useGame((s) => s.over)
  const round = useGame((s) => s.round)
  const rounds = useGame((s) => s.rounds)
  const start = useGame((s) => s.start)
  const decide = useGame((s) => s.decide)
  const next = useGame((s) => s.next)
  const playAgain = useGame((s) => s.playAgain)

  // Each data-hud, like the bubble's data-line, is a stable hook for driving the page in a browser
  return (
    <div className="hud">
      {phase === 'title' ? <TitleCard onStart={start} /> : <Tab />}
      <div className="buttons">
        {awaiting === 'decision' && (
          <>
            <button type="button" data-hud="stay" onClick={() => decide('stay')}>
              Stay
            </button>
            <button type="button" data-hud="switch" onClick={() => decide('switch')}>
              Switch
            </button>
          </>
        )}
        {awaiting === 'next' && (
          <button type="button" data-hud="next" onClick={next}>
            {round === rounds ? 'Finale' : 'Next round'}
          </button>
        )}
        {over && (
          <button type="button" data-hud="again" onClick={playAgain}>
            Play again
          </button>
        )}
      </div>
    </div>
  )
}
