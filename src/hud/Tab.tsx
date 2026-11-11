import type { RoundResult } from '../game/director.ts'
import type { Choice } from '../game/rules.ts'
import { formatAmount } from '../game/script.ts'
import { useGame } from '../store.ts'

// How each choice has done so far, as "won 3 of 4", or nothing before it's been made
function record(rounds: RoundResult[], choice: Choice) {
  const made = rounds.filter((round) => round.choice === choice)
  if (made.length === 0) return null
  return `won ${made.filter((round) => round.won).length} of ${made.length}`
}

// The running tab: the round in play and its prize, a line for each round played, how staying
// and switching have done in the Monty Hall game, and the total. At the finale it's the receipt
export function Tab() {
  const phase = useGame((s) => s.phase)
  const round = useGame((s) => s.round)
  const rounds = useGame((s) => s.rounds)
  const prize = useGame((s) => s.prize)
  const currency = useGame((s) => s.currency)
  const played = useGame((s) => s.tab.rounds)
  const total = useGame((s) => s.tab.total)
  const bonus = useGame((s) => s.tab.bonus)
  const amount = (value: number) => formatAmount(value, currency)

  // Only the Monty Hall game records a choice
  const tally = [
    ['Switched', record(played, 'switch')],
    ['Stayed', record(played, 'stay')],
  ].flatMap(([choice, result]) => (result ? [`${choice}: ${result}`] : []))

  return (
    <div className="tab" data-hud="tab">
      {phase === 'finale' ? (
        <div className="heading">The final tab</div>
      ) : (
        round > 0 && (
          <div className="heading">
            Round {round} of {rounds}
            {prize !== null && <> · for {amount(prize)}</>}
          </div>
        )
      )}
      {played.length > 0 && (
        <ol className="rounds">
          {played.map((result) => (
            <li key={result.round} data-hud="round" className={result.won ? 'won' : 'lost'}>
              <span className="number">{result.round}</span>
              {result.choice && (
                <span className="choice">{result.choice === 'stay' ? 'Stayed' : 'Switched'}</span>
              )}
              <span className="amount">{amount(result.won ? result.prize : 0)}</span>
            </li>
          ))}
        </ol>
      )}
      {tally.length > 0 && (
        <div className="tally" data-hud="tally">
          {tally.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      )}
      {bonus > 0 && <div data-hud="bonus">Bonus {amount(bonus)}</div>}
      <div className="total" data-hud="total">
        Total {amount(total)}
      </div>
    </div>
  )
}
