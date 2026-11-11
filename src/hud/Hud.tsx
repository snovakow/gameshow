import { useControls } from 'leva'
import { useEffect } from 'react'
import { formatAmount } from '../game/script.ts'
import { useGame } from '../store.ts'

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

// The show's buttons and a minimal tab, drawn over the canvas and outside its events
export function Hud() {
  useGameFolder()
  const phase = useGame((s) => s.phase)
  const awaiting = useGame((s) => s.awaiting)
  const over = useGame((s) => s.over)
  const round = useGame((s) => s.round)
  const rounds = useGame((s) => s.rounds)
  const prize = useGame((s) => s.prize)
  const currency = useGame((s) => s.currency)
  const total = useGame((s) => s.tab.total)
  const bonus = useGame((s) => s.tab.bonus)
  const start = useGame((s) => s.start)
  const decide = useGame((s) => s.decide)
  const next = useGame((s) => s.next)
  const playAgain = useGame((s) => s.playAgain)
  const amount = (value: number) => formatAmount(value, currency)

  // Each data-hud, like the bubble's data-line, is a stable hook for driving the page in a browser
  return (
    <div className="hud">
      {phase !== 'title' && (
        <div className="tab" data-hud="tab">
          {round > 0 && (
            <div>
              Round {round} of {rounds}
              {prize !== null && phase !== 'finale' && <> · for {amount(prize)}</>}
            </div>
          )}
          {bonus > 0 && <div>Bonus {amount(bonus)}</div>}
          <div className="total">Total {amount(total)}</div>
        </div>
      )}
      <div className="buttons">
        {phase === 'title' && (
          <button type="button" data-hud="start" onClick={start}>
            Start the show
          </button>
        )}
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
