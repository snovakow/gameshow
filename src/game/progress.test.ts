import assert from 'node:assert/strict'
import { test } from 'node:test'
import { giftDefaults, type Config } from './config.ts'
import type { RoundResult } from './director.ts'
import { roundPrize } from './prizes.ts'
import { parseProgress, resumePoint, serializeProgress } from './progress.ts'
import { mulberry32, type Random } from './random.ts'

function gift(overrides: Partial<Config> = {}): Config {
  return { ...giftDefaults(), name: 'Alex', ...overrides }
}

// A whole show's results by the rules, each round's prize set from the tab before it, with wins
// and choices drawn from a seed so the paths vary
function playPath(config: Config, random: Random): RoundResult[] {
  const results: RoundResult[] = []
  let total = 0
  let previous = 0
  for (let round = 1; round <= config.rounds; round++) {
    const prize = roundPrize(config, round, total, previous)
    const won = random() < 0.5
    const choice = config.game === 'montyHall' ? (random() < 0.5 ? 'stay' : 'switch') : null
    results.push({ round, prize, choice, won })
    if (won) total += prize
    previous = prize
  }
  return results
}

void test('saved progress parses back as it was written', () => {
  const config = gift()
  const results = playPath(config, mulberry32(1))
  for (const count of [0, 2, config.rounds]) {
    const saved = results.slice(0, count)
    assert.deepEqual(parseProgress(serializeProgress(saved, false), config), {
      v: 1,
      results: saved,
      finished: false,
    })
  }
  assert.deepEqual(parseProgress(serializeProgress(results, true), config)?.finished, true)
  const simple = gift({ game: 'simple' })
  const simpleResults = playPath(simple, mulberry32(2))
  assert.deepEqual(parseProgress(serializeProgress(simpleResults, true), simple)?.results, simpleResults)
})

void test('progress that does not fit is ignored', () => {
  const config = gift()
  const results = playPath(config, mulberry32(3))
  const json = (value: unknown) => JSON.stringify(value)
  const valid = { v: 1, results: results.slice(0, 2), finished: false }
  const cases: [string, string | null][] = [
    ['nothing saved', null],
    ['not JSON', '{"v":1,'],
    ['not an object', json([valid])],
    ['another version', json({ ...valid, v: 2 })],
    ['no finished flag', json({ v: 1, results: valid.results })],
    ['results not a list', json({ ...valid, results: {} })],
    ['more rounds than the gift has', json({ ...valid, results: [...results, results[0]] })],
    ['finished early', json({ ...valid, finished: true })],
    ['a round out of order', json({ ...valid, results: [results[1], results[0]] })],
    ['a prize the rules never set', json({ ...valid, results: [{ ...results[0], prize: 15 }] })],
    ['a prize as text', json({ ...valid, results: [{ ...results[0], prize: '10' }] })],
    ['won as text', json({ ...valid, results: [{ ...results[0], won: 'yes' }] })],
    ['a choice in Monty Hall missing', json({ ...valid, results: [{ ...results[0], choice: null }] })],
    ['a choice that is neither', json({ ...valid, results: [{ ...results[0], choice: 'keep' }] })],
    ['a result that is not an object', json({ ...valid, results: [7] })],
  ]
  for (const [label, text] of cases) assert.equal(parseProgress(text, config), null, label)
  // Simple mode records no choice
  const simple = gift({ game: 'simple' })
  const withChoice = playPath(simple, mulberry32(4)).map((r) => ({ ...r, choice: 'stay' }))
  assert.equal(parseProgress(json({ v: 1, results: withChoice, finished: true }), simple), null)
  // Another gift's progress, its prizes on another path, doesn't carry over
  const other = gift({ target: 200, max: 280, min: 120 })
  assert.equal(parseProgress(serializeProgress(results.slice(0, 2), false), other), null)
})

void test('the resume point after 0, 2 and every round', () => {
  const config = gift()
  const results: RoundResult[] = [
    { round: 1, prize: 10, choice: 'switch', won: true },
    { round: 2, prize: 20, choice: 'stay', won: false },
    { round: 3, prize: 40, choice: 'switch', won: true },
    { round: 4, prize: 45, choice: 'switch', won: false },
    { round: 5, prize: 50, choice: 'stay', won: false },
  ]
  assert.deepEqual(resumePoint([]), { round: 1, total: 0, previous: 0, wins: 0, losses: 0 })
  assert.deepEqual(resumePoint(results.slice(0, 2)), {
    round: 3,
    total: 10,
    previous: 20,
    wins: 1,
    losses: 1,
  })
  // With every round decided, only the finale is left
  assert.deepEqual(resumePoint(results), { round: 6, total: 50, previous: 50, wins: 2, losses: 3 })
  assert.equal(resumePoint(results).round, config.rounds + 1)
})

void test('within-range prizes recomputed from saved results match the original path', () => {
  let paths = 0
  for (const game of ['montyHall', 'simple'] as const) {
    for (const rounds of [1, 3, 5, 10]) {
      const config = gift({ game, rounds, target: 100, min: 60, max: 140 })
      for (let seed = 1; seed <= 40; seed++) {
        const original = playPath(config, mulberry32(seed * 31 + rounds))
        for (let saved = 0; saved < rounds; saved++) {
          const { round, total, previous } = resumePoint(original.slice(0, saved))
          assert.equal(round, saved + 1)
          assert.equal(roundPrize(config, round, total, previous), original[saved].prize)
        }
        // The whole path, read back, is accepted as this gift's
        assert.ok(parseProgress(serializeProgress(original, true), config))
        paths++
      }
    }
  }
  assert.equal(paths, 320)
})
