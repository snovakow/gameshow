import assert from 'node:assert/strict'
import { test } from 'node:test'
import { giftDefaults, validateConfig, type Config, type GameMode } from './config.ts'
import { mulberry32 } from './random.ts'
import { bonus, ladder, roundPrize, simulate, withinRangeStep, type PrizeStep } from './prizes.ts'

function settings(overrides: Partial<Config>): Config {
  return { ...giftDefaults(), name: 'Alex', ...overrides }
}

// One show along a fixed run of wins and losses
interface Path {
  config: Config
  wins: boolean[]
  steps: PrizeStep[]
  // The tab before the bonus, and the bonus it earns
  total: number
  bonus: number
}

function play(config: Config, wins: boolean[]): Path {
  const steps: PrizeStep[] = []
  let total = 0
  let previous = 0
  wins.forEach((won, i) => {
    const step = withinRangeStep(config, i + 1, total, previous)
    steps.push(step)
    if (won) total += step.prize
    previous = step.prize
  })
  return { config, wins, steps, total, bonus: bonus(config, total) }
}

// Every win and loss path of every configuration the guarantees are checked over
const gameModes: GameMode[] = ['montyHall', 'simple']
const roundCounts = [1, 2, 5, 10]
const stepSizes = [1, 5]
const ranges = [
  [100, 60, 140],
  [100, 100, 100],
  [100, 0, 100],
  [200, 150, 250],
]
const configs: Config[] = []
for (const game of gameModes) {
  for (const rounds of roundCounts) {
    for (const step of stepSizes) {
      for (const [target, min, max] of ranges) {
        const result = validateConfig(
          settings({ game, prizes: 'withinRange', rounds, step, target, min, max }),
          'gift',
        )
        if (result.ok) configs.push(result.config)
      }
    }
  }
}
const paths: Path[] = configs.flatMap((config) =>
  Array.from({ length: 2 ** config.rounds }, (_, mask) =>
    play(
      config,
      Array.from({ length: config.rounds }, (_round, i) => Boolean(mask & (1 << i))),
    ),
  ),
)

const describe = ({ config, wins }: Path) =>
  `${config.game} ${config.rounds} rounds, step ${config.step}, ` +
  `${config.target} in ${config.min}–${config.max}, ${wins.map((won) => (won ? 'W' : 'L')).join('')}`

void test('the guarantees cover every combination named, each over every path', () => {
  // Each combination is valid, so validation skips none of them
  assert.equal(
    configs.length,
    gameModes.length * roundCounts.length * stepSizes.length * ranges.length,
  )
  assert.equal(paths.length, 16992)
})

void test('within range, every show ends between the min and the max', () => {
  const broken = paths.filter(({ config, total, bonus: extra }) => {
    const end = total + extra
    return end < config.min || end > config.max
  })
  assert.deepEqual(broken.map(describe), [])
})

void test('within range, every prize is a multiple of the step, at least the step, and never falls', () => {
  const broken = paths.filter(({ config, steps: path }) =>
    path.some(
      ({ prize }, i) =>
        prize % config.step !== 0 || prize < config.step || (i > 0 && prize < path[i - 1].prize),
    ),
  )
  assert.deepEqual(broken.map(describe), [])
})

void test('within range, winning the final round brings the tab to at least the target', () => {
  const finalWins = paths.filter(({ wins }) => wins[wins.length - 1])
  assert.equal(finalWins.length, paths.length / 2)
  const broken = finalWins.filter(({ config, total }) => total < config.target)
  assert.deepEqual(broken.map(describe), [])
})

void test('within range, with the min, target and max equal every show ends on the target', () => {
  const fixed = paths.filter(({ config }) => config.min === config.max)
  assert.ok(fixed.length > 0)
  const broken = fixed.filter(({ config, total, bonus: extra }) => total + extra !== config.target)
  assert.deepEqual(broken.map(describe), [])
})

void test('within range, the high bound is never below the low one', () => {
  const broken = paths.filter(({ steps: path }) => path.some(({ low, high }) => high < low))
  assert.deepEqual(broken.map(describe), [])
})

void test('pure odds pays a fixed ladder that averages the target at the mode’s odds', () => {
  const montyHall = settings({ prizes: 'pureOdds' })
  const simple = settings({ prizes: 'pureOdds', game: 'simple' })
  assert.deepEqual(ladder(montyHall), [10, 20, 30, 40, 50])
  assert.deepEqual(ladder(simple), [20, 40, 60, 80, 100])
  // The ladder doesn't depend on the tab, and pure odds pays no bonus
  assert.equal(roundPrize(montyHall, 3, 0, 0), 30)
  assert.equal(roundPrize(montyHall, 3, 90, 20), 30)
  assert.equal(bonus(montyHall, 0), 0)
  // Every prize is at least the step, even where the share rounds to nothing
  assert.deepEqual(ladder(settings({ prizes: 'pureOdds', target: 5, rounds: 10 })), Array.from({ length: 10 }, () => 5))
})

void test('within range, the example paths come out as worked by hand', () => {
  const config = settings({})
  const prizes = (path: Path) => path.steps.map(({ prize }) => prize)

  const allWon = play(config, [true, true, true, true, true])
  assert.deepEqual(prizes(allWon), [10, 20, 25, 30, 30])
  assert.equal(allWon.total, 115)
  assert.equal(allWon.bonus, 0)

  const lastWon = play(config, [false, false, false, false, true])
  assert.deepEqual(prizes(lastWon), [10, 20, 40, 65, 100])
  assert.equal(lastWon.total, 100)
  assert.equal(lastWon.bonus, 0)

  const allLost = play(config, [false, false, false, false, false])
  assert.deepEqual(prizes(allLost), [10, 20, 40, 65, 100])
  assert.equal(allLost.total, 0)
  assert.equal(allLost.bonus, 60)

  // roundPrize gives the same prize from the tab and the previous prize alone, as a resumed show
  // recomputes it
  assert.equal(roundPrize(config, 3, 0, 20), 40)
  assert.equal(roundPrize(config, 3, 30, 20), 25)
})

void test('simulated shows average the target when switching, and less when staying', () => {
  const config = settings({})
  const count = 100000
  const switching = simulate(config, 'switch', count, mulberry32(5))
  assert.ok(Math.abs(switching.average - 100) <= 2, `switching averaged ${switching.average}`)
  assert.equal(switching.p10, 60)
  assert.equal(switching.p90, 120)
  assert.ok(switching.least >= config.min && switching.most <= config.max)
  assert.equal(switching.ladder, null)

  const staying = simulate(config, 'stay', count, mulberry32(6))
  assert.ok(Math.abs(staying.average - 79) <= 2, `staying averaged ${staying.average}`)
  assert.ok(staying.bonusRate > switching.bonusRate)

  const pure = simulate(settings({ prizes: 'pureOdds' }), 'switch', count, mulberry32(7))
  assert.ok(Math.abs(pure.average - 100) <= 2, `pure odds averaged ${pure.average}`)
  assert.deepEqual(pure.ladder, [10, 20, 30, 40, 50])
  assert.equal(pure.bonusRate, 0)
  assert.ok(pure.least >= 0 && pure.most <= 150)
})
