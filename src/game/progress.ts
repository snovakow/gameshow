import type { Config } from './config.ts'
import type { RoundResult } from './director.ts'
import { roundPrize } from './prizes.ts'

// A gift link's progress in one browser: each round decided so far, saved the moment its final
// choice is made, and whether the show has reached its finale
export interface Progress {
  v: typeof progressVersion
  results: RoundResult[]
  finished: boolean
}

export const progressVersion = 1

// Where a show picks up from its saved rounds: the round to play next (one past the last when
// only the finale is left), the tab so far and the last prize, from which the next prize is set,
// and how many wins and losses the host has reacted to, so her dances and sulks keep their turns
export interface ResumePoint {
  round: number
  total: number
  previous: number
  wins: number
  losses: number
}

export function resumePoint(results: readonly RoundResult[]): ResumePoint {
  let total = 0
  let wins = 0
  for (const result of results) {
    if (!result.won) continue
    total += result.prize
    wins++
  }
  return {
    round: results.length + 1,
    total,
    previous: results.at(-1)?.prize ?? 0,
    wins,
    losses: results.length - wins,
  }
}

export function serializeProgress(results: readonly RoundResult[], finished: boolean): string {
  const progress: Progress = { v: progressVersion, results: [...results], finished }
  return JSON.stringify(progress)
}

// Reads saved progress back, or null when there is none or it doesn't fit this gift: a value
// from another version, one that fails to parse, or rounds whose prizes this gift's rules would
// never have set. Each saved prize is recomputed along the saved path, so what resumes is a show
// this gift could have played
export function parseProgress(text: string | null, config: Config): Progress | null {
  if (text === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const fields = new Map<string, unknown>(Object.entries(parsed))
  const saved = fields.get('results')
  const finished = fields.get('finished')
  if (fields.get('v') !== progressVersion || typeof finished !== 'boolean') return null
  if (!Array.isArray(saved) || saved.length > config.rounds) return null
  if (finished && saved.length !== config.rounds) return null

  const results: RoundResult[] = []
  for (const entry of saved) {
    const result = readResult(entry, results.length + 1, config.game === 'montyHall')
    if (!result) return null
    const { total, previous } = resumePoint(results)
    if (result.prize !== roundPrize(config, result.round, total, previous)) return null
    results.push(result)
  }
  return { v: progressVersion, results, finished }
}

function readResult(entry: unknown, round: number, montyHall: boolean): RoundResult | null {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null
  const fields = new Map<string, unknown>(Object.entries(entry))
  const prize = fields.get('prize')
  const choice = fields.get('choice')
  const won = fields.get('won')
  if (fields.get('round') !== round || typeof prize !== 'number' || typeof won !== 'boolean') {
    return null
  }
  // Only the Monty Hall game records a choice
  if (montyHall) {
    if (choice !== 'stay' && choice !== 'switch') return null
    return { round, prize, choice, won }
  }
  if (choice !== null) return null
  return { round, prize, choice: null, won }
}
