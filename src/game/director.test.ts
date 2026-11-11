import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoDefaults, type Config, type GameMode, type PrizeMode } from './config.ts'
import { runShow, type CrateSetup, type RoundResult, type ShowIO } from './director.ts'
import { bonus as bonusFor } from './prizes.ts'
import { mulberry32, type Random } from './random.ts'
import type { Choice } from './rules.ts'

// One io call, as the log records it: its name and what it was given
interface Call {
  name: string
  arg?: unknown
}

interface Played {
  calls: Call[]
  total: number
  results: RoundResult[]
  // Per round: the crates as set, the pick, the crate the host opened, and the final crate
  rounds: { crates: CrateSetup[]; pick: number; opened: number | null; final: number | null }[]
  finish: { total: number; bonus: number } | null
}

interface Script {
  // The player's pick and choice per round, from a seeded draw so every path is covered
  pick: (round: number) => number
  choose: (round: number) => Choice
}

// A fake io that resolves every step at once and answers with the scripted inputs
function fakeIO(script: Script, onCall?: (call: Call) => void) {
  const played: Played = { calls: [], total: 0, results: [], rounds: [], finish: null }
  let round = 0
  const log = (name: string, arg?: unknown) => {
    const call = { name, arg }
    played.calls.push(call)
    onCall?.(call)
  }
  const current = () => played.rounds[played.rounds.length - 1]
  const io: ShowIO = {
    say: (line) => {
      log('say', line.key)
      return Promise.resolve()
    },
    wait: (ms) => {
      log('wait', ms)
      return Promise.resolve()
    },
    cue: (name) => log('cue', name),
    pose: (name) => log('pose', name),
    setPhase: (phase) => log('phase', phase),
    setRound: (info) => {
      round = info.round
      log('setRound', info)
    },
    setCrates: (crates) => {
      played.rounds.push({ crates, pick: -1, opened: null, final: null })
      log('setCrates', crates)
    },
    openCrate: (crate) => {
      const r = current()
      // The first crate opened after the pick and before a decision is the host's
      if (r.opened === null && r.final === null && played.calls.at(-1)?.arg === 'hostOpens') {
        r.opened = crate
      } else if (r.final === null) {
        r.final = crate
      }
      log('openCrate', crate)
    },
    closeCrates: () => {
      log('closeCrates')
      return Promise.resolve()
    },
    awaitPick: () => {
      log('awaitPick')
      const pick = script.pick(round)
      current().pick = pick
      return Promise.resolve(pick)
    },
    awaitDecision: () => {
      log('awaitDecision')
      return Promise.resolve(script.choose(round))
    },
    awaitNext: () => {
      log('awaitNext')
      return Promise.resolve()
    },
    recordRound: (result) => {
      played.results.push(result)
      log('recordRound', result)
    },
    addToTab: (result, total) => {
      played.total = total
      log('addToTab', { result, total })
    },
    finish: (total, bonus) => {
      played.finish = { total, bonus }
      log('finish', { total, bonus })
    },
  }
  return { io, played }
}

function config(game: GameMode, prizes: PrizeMode, overrides: Partial<Config> = {}): Config {
  return { ...demoDefaults(), game, prizes, ...overrides }
}

async function play(cfg: Config, script: Script, random: Random) {
  const { io, played } = fakeIO(script)
  const total = await runShow(cfg, io, { kind: 'demo', random, signal: new AbortController().signal })
  return { played, total }
}

// The io calls between a round's crates being set and the next round's, as names
function roundCalls(calls: Call[], round: number): string[] {
  const starts = calls.flatMap((call, i) => (call.name === 'setCrates' ? [i] : []))
  const end = round < starts.length ? starts[round] : calls.findIndex((c) => c.name === 'finish')
  return calls
    .slice(starts[round - 1], end)
    .map((call) =>
      ['say', 'cue', 'phase', 'wait'].includes(call.name) ? `${call.name} ${String(call.arg)}` : call.name,
    )
}

const seeded = (seed: number): Script => {
  const random = mulberry32(seed)
  return { pick: () => Math.floor(random() * 3), choose: () => (random() < 0.5 ? 'stay' : 'switch') }
}

const always = (choice: Choice, seed: number): Script => ({ ...seeded(seed), choose: () => choice })

void test('a Monty Hall round runs its steps in order', async () => {
  const { played } = await play(config('montyHall', 'pureOdds'), always('stay', 1), mulberry32(1))
  const won = played.results[0].won
  assert.deepEqual(roundCalls(played.calls, 1), [
    'setCrates',
    'setRound',
    'phase pick',
    'cue roundStart',
    'say round',
    'say pick',
    'awaitPick',
    'cue pick',
    'say picked',
    'phase decide',
    'say hostOpens',
    'openCrate',
    'cue hostOpens',
    'cue dud',
    'say offer',
    'awaitDecision',
    'cue stay',
    'say stayed',
    'recordRound',
    'phase reveal',
    'say open',
    'cue drumroll',
    'wait 2500',
    'openCrate',
    'cue reveal',
    won ? 'cue win' : 'cue lose',
    'pose',
    won ? 'say won' : 'say lost',
    'openCrate',
    'openCrate',
    'addToTab',
    'phase result',
    'say total',
    'awaitNext',
    'cue next',
    'closeCrates',
    // The next round's guard: every lid shut before its texts are set
    'closeCrates',
  ])
})

void test('a simple round skips the host and the decision', async () => {
  const { played } = await play(config('simple', 'pureOdds'), seeded(2), mulberry32(2))
  const calls = roundCalls(played.calls, 1)
  assert.deepEqual(calls.slice(0, 9), [
    'setCrates',
    'setRound',
    'phase pick',
    'cue roundStart',
    'say round',
    'say pick',
    'awaitPick',
    'cue pick',
    'say picked',
  ])
  assert.deepEqual(calls.slice(9, 12), ['recordRound', 'phase reveal', 'say open'])
  for (const absent of ['awaitDecision', 'say hostOpens', 'say offer', 'cue dud', 'phase decide']) {
    assert.ok(!played.calls.some((c) => `${c.name} ${String(c.arg)}`.startsWith(absent)), absent)
    assert.ok(!calls.includes(absent), absent)
  }
})

void test('the show opens with the welcome and the rules, and the final round is named', async () => {
  for (const game of ['montyHall', 'simple'] as const) {
    const { played } = await play(config(game, 'pureOdds', { rounds: 3 }), seeded(3), mulberry32(3))
    const said = played.calls.filter((c) => c.name === 'say').map((c) => c.arg)
    assert.deepEqual(said.slice(0, 3), ['welcome', game === 'montyHall' ? 'rules' : 'rulesSimple', 'round'])
    assert.equal(said.filter((key) => key === 'round').length, 2)
    assert.equal(said.filter((key) => key === 'finalRound').length, 1)
    const cues = played.calls.filter((c) => c.name === 'cue').map((c) => c.arg)
    assert.equal(cues[0], 'showStart')
    assert.equal(cues.at(-1), 'finale')
  }
})

void test('every mode plays whole shows, its total the sum of the rounds won', async () => {
  const random = mulberry32(4)
  let shows = 0
  for (const game of ['montyHall', 'simple'] as const) {
    for (const prizes of ['pureOdds', 'withinRange'] as const) {
      for (const strategy of ['stay', 'switch', 'mixed'] as const) {
        if (game === 'simple' && strategy !== 'mixed') continue
        for (let seed = 0; seed < 40; seed++) {
          const cfg = config(game, prizes)
          const script = strategy === 'mixed' ? seeded(seed) : always(strategy, seed)
          const { played, total } = await play(cfg, script, random)
          shows++
          assert.equal(played.results.length, cfg.rounds)
          const won = played.results.reduce((sum, r) => sum + (r.won ? r.prize : 0), 0)
          assert.equal(played.total, won)
          const extra = bonusFor(cfg, won)
          assert.deepEqual(played.finish, { total: won, bonus: extra })
          assert.equal(total, won + extra)
          if (prizes === 'withinRange') assert.ok(total >= cfg.min && total <= cfg.max, `${total}`)
          for (const [i, r] of played.rounds.entries()) {
            // One crate holds the round's prize, the rest are empty
            assert.equal(r.crates.filter((c) => c.kind === 'prize').length, 1)
            assert.equal(r.crates.find((c) => c.kind === 'prize')?.text, `$${played.results[i].prize}`)
            assert.ok(r.crates.filter((c) => c.kind === 'dud').every((c) => c.text === '$0'))
            const winner = r.crates.findIndex((c) => c.kind === 'prize')
            const final = game === 'montyHall' ? r.final : r.pick
            assert.equal(played.results[i].won, final === winner)
            assert.equal(played.results[i].choice === null, game === 'simple')
            if (game === 'montyHall') {
              assert.equal(r.final === r.pick, played.results[i].choice === 'stay')
            }
          }
        }
      }
    }
  }
  assert.equal(shows, 40 * 8)
})

void test("the host's crate is never the pick or the prize", async () => {
  const random = mulberry32(5)
  let rounds = 0
  for (let seed = 0; seed < 200; seed++) {
    const { played } = await play(config('montyHall', 'pureOdds'), seeded(seed), random)
    for (const r of played.rounds) {
      const winner = r.crates.findIndex((c) => c.kind === 'prize')
      assert.notEqual(r.opened, null)
      assert.notEqual(r.opened, r.pick)
      assert.notEqual(r.opened, winner)
      rounds++
    }
  }
  assert.equal(rounds, 1000)
})

void test('a round is recorded at the final choice, before the drumroll', async () => {
  for (const game of ['montyHall', 'simple'] as const) {
    const { played } = await play(config(game, 'withinRange'), seeded(6), mulberry32(6))
    const names = played.calls.map((c) => `${c.name} ${String(c.arg)}`)
    const records = names.flatMap((n, i) => (n.startsWith('recordRound') ? [i] : []))
    const drumrolls = names.flatMap((n, i) => (n === 'cue drumroll' ? [i] : []))
    const decisions = names.flatMap((n, i) =>
      n === (game === 'montyHall' ? 'say stayed' : 'say picked') || n === 'say switched' ? [i] : [],
    )
    assert.equal(records.length, 5)
    records.forEach((record, i) => {
      assert.ok(decisions[i] < record && record < drumrolls[i])
      // The reveal hasn't shown it yet, so the tab doesn't have it
      const added = names.findIndex((n, j) => j > record && n.startsWith('addToTab'))
      assert.ok(added > drumrolls[i])
    })
  }
})

void test('the bonus comes at the finale, only within range and below the min', async () => {
  const random = mulberry32(7)
  const stayOnFirst: Script = { pick: () => 0, choose: () => 'stay' }
  let paid = 0
  let unpaid = 0
  for (const prizes of ['pureOdds', 'withinRange'] as const) {
    for (let seed = 0; seed < 60; seed++) {
      const cfg = config('montyHall', prizes)
      const { played } = await play(cfg, seed % 3 ? seeded(seed) : stayOnFirst, random)
      const won = played.results.reduce((sum, r) => sum + (r.won ? r.prize : 0), 0)
      const due = prizes === 'withinRange' && won < cfg.min
      const names = played.calls.map((c) => `${c.name} ${String(c.arg)}`)
      const bonusCue = names.indexOf('cue bonus')
      assert.equal(bonusCue !== -1, due)
      assert.equal(names.includes('say bonus'), due)
      if (due) {
        paid++
        // After the last round's Next, before the finale
        assert.ok(bonusCue > names.lastIndexOf('cue next'))
        assert.ok(bonusCue < names.indexOf('cue finale'))
        assert.equal(played.finish?.bonus, cfg.min - won)
      } else {
        unpaid++
        assert.equal(played.finish?.bonus, 0)
      }
    }
  }
  assert.ok(paid > 0 && unpaid > 0)
})

void test('the odds fact closes a Monty Hall show only', async () => {
  for (const game of ['montyHall', 'simple'] as const) {
    const { played } = await play(config(game, 'pureOdds'), seeded(8), mulberry32(8))
    const said = played.calls.filter((c) => c.name === 'say').map((c) => c.arg)
    assert.equal(said.includes('oddsFact'), game === 'montyHall')
    assert.equal(said.at(-1), game === 'montyHall' ? 'oddsFact' : 'finale')
  }
})

void test('wins and losses take their poses in turn', async () => {
  const stayOnFirst: Script = { pick: () => 0, choose: () => 'stay' }
  const random = mulberry32(9)
  const { played } = await play(config('montyHall', 'pureOdds', { rounds: 10 }), stayOnFirst, random)
  const poses = played.calls.filter((c) => c.name === 'pose').map((c) => String(c.arg))
  const results = played.results.map((r) => r.won)
  const wins = poses.filter((_, i) => results[i])
  const losses = poses.filter((_, i) => !results[i])
  assert.ok(wins.length > 1 && losses.length > 1)
  wins.forEach((pose, i) => assert.ok(pose.startsWith('Samba') && pose !== wins[i - 1]))
  losses.forEach((pose, i) => assert.ok(!pose.startsWith('Samba') && pose !== losses[i - 1]))
})

void test('an abort mid-round makes no further io call', async () => {
  // Stopped at each kind of step: a line, the pick, the decision, the drumroll and Next
  for (const at of ['say offer', 'awaitPick', 'awaitDecision', 'wait 2500', 'awaitNext']) {
    const controller = new AbortController()
    let stoppedAt = -1
    const { io, played } = fakeIO(seeded(10), (call) => {
      // The second round, so a whole round has run first
      const label = call.name === 'say' || call.name === 'wait' ? `${call.name} ${String(call.arg)}` : call.name
      if (label === at && played.rounds.length === 2 && stoppedAt === -1) {
        stoppedAt = played.calls.length
        controller.abort(new Error('stopped'))
      }
    })
    await assert.rejects(
      runShow(config('montyHall', 'withinRange'), io, {
        kind: 'demo',
        random: mulberry32(10),
        signal: controller.signal,
      }),
      /stopped/,
    )
    assert.ok(stoppedAt > 0, at)
    assert.equal(played.calls.length, stoppedAt, at)
  }
})

void test('a step that never settles still stops the show', async () => {
  const controller = new AbortController()
  const { io, played } = fakeIO(seeded(11))
  const calls: string[] = []
  const stuck: ShowIO = {
    ...io,
    awaitPick: () => {
      calls.push('awaitPick')
      setTimeout(() => controller.abort(new Error('stopped')), 5)
      return new Promise<number>(() => {})
    },
  }
  await assert.rejects(
    runShow(config('simple', 'pureOdds'), stuck, {
      kind: 'demo',
      random: mulberry32(11),
      signal: controller.signal,
    }),
    /stopped/,
  )
  assert.deepEqual(calls, ['awaitPick'])
  assert.equal(played.calls.at(-1)?.arg, 'pick')
})

void test('a show already stopped makes no call at all', async () => {
  const controller = new AbortController()
  controller.abort(new Error('stopped'))
  const { io, played } = fakeIO(seeded(12))
  await assert.rejects(
    runShow(config('montyHall', 'pureOdds'), io, { kind: 'demo', random: Math.random, signal: controller.signal }),
    /stopped/,
  )
  assert.equal(played.calls.length, 0)
})
