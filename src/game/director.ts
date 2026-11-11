import type { Config } from './config.ts'
import { bonus, roundPrize } from './prizes.ts'
import type { Random } from './random.ts'
import { crateCount, finalCrate, hostOpens, otherCrate, randomCrate, type Choice } from './rules.ts'
import {
  createScript,
  formatAmount,
  type LineKey,
  type LineValues,
  type ShowKind,
} from './script.ts'

// The show's stages, which the store and the HUD read to know what the player is doing
export type Phase = 'title' | 'intro' | 'pick' | 'decide' | 'reveal' | 'result' | 'finale'

// Moments the stage reacts to, and later the sound and the lights, each once
export type CueName =
  | 'showStart'
  | 'roundStart'
  | 'pick'
  | 'hostOpens'
  | 'dud'
  | 'stay'
  | 'switch'
  | 'drumroll'
  | 'reveal'
  | 'win'
  | 'lose'
  | 'next'
  | 'bonus'
  | 'finale'

// The host's poses, by the names her clips carry
export type PoseName =
  | 'Samba Dancing'
  | 'Samba Dancing 2'
  | 'Samba Dancing 3'
  | 'Sad'
  | 'Defeated'
  | 'Rejected'

// A pose that is already playing doesn't restart, so wins and losses take their poses in turn
const winPoses: readonly PoseName[] = ['Samba Dancing', 'Samba Dancing 2', 'Samba Dancing 3']
const losePoses: readonly PoseName[] = ['Sad', 'Defeated', 'Rejected']

// The empty crates show nothing won
export type CrateKind = 'prize' | 'dud'

export interface CrateSetup {
  text: string
  kind: CrateKind
}

export interface RoundInfo {
  round: number
  rounds: number
  prize: number
}

// A decided round, saved the moment the final choice is made
export interface RoundResult {
  round: number
  prize: number
  // Monty Hall only: whether the player kept the pick
  choice: Choice | null
  won: boolean
}

// A line as the host says it: the key it came from and its text, filled in
export interface Line {
  key: LineKey
  text: string
}

// What the director drives, with crates numbered from 0. The store implements it for the page
// and the tests with a fake. Each is a property, not a method, so it can be passed around unbound
export interface ShowIO {
  // Resolves when the line's hold ends, or the player skips it
  say: (line: Line) => Promise<void>
  wait: (ms: number) => Promise<void>
  cue: (name: CueName) => void
  pose: (name: PoseName) => void
  setPhase: (phase: Phase) => void
  setRound: (info: RoundInfo) => void
  // Called only with every lid shut, so no text changes in an open crate
  setCrates: (crates: CrateSetup[]) => void
  openCrate: (crate: number) => void
  // Resolves once every lid reports itself shut
  closeCrates: () => Promise<void>
  // Each resolves on the player's input, which is ignored at any other time
  awaitPick: () => Promise<number>
  awaitDecision: () => Promise<Choice>
  awaitNext: () => Promise<void>
  // The round's result, saved before the reveal so a decided round is never replayed
  recordRound: (result: RoundResult) => void
  // The round joins the tab, after the reveal shows it
  addToTab: (result: RoundResult, total: number) => void
  // The show's end: the tab's total and the bonus that lifts it
  finish: (total: number, bonus: number) => void
}

export interface ShowOptions {
  kind: ShowKind
  random: Random
  signal: AbortSignal
}

// The drumroll's length before the final crate opens
const drumrollMs = 2500

// Waits for a step, giving up at once when the show is stopped, so nothing runs after an abort
// even if the step itself never settles
function untilAborted<T>(signal: AbortSignal, step: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    step.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) reject(signal.reason)
        else resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(signal.aborted ? signal.reason : error)
      },
    )
  })
}

// Runs a whole show: the intro, every round and the finale. Rejects with the signal's reason
// when stopped; resolves with the final total, the bonus included
export async function runShow(config: Config, io: ShowIO, options: ShowOptions): Promise<number> {
  const { random, signal } = options
  const script = createScript(config, options.kind)
  const montyHall = config.game === 'montyHall'
  const amount = (value: number) => formatAmount(value, config.currency)

  // Every call into io goes through these, so none is made once the show is stopped
  const act = () => signal.throwIfAborted()
  const step = <T>(promise: Promise<T>) => untilAborted(signal, promise)
  const say = async (key: LineKey, values?: LineValues) => {
    act()
    await step(io.say({ key, text: script(key, values) }))
  }
  const cue = (name: CueName) => {
    act()
    io.cue(name)
  }

  let total = 0
  let previous = 0
  let wins = 0
  let losses = 0

  act()
  io.setPhase('intro')
  cue('showStart')
  await say('welcome')
  await say(montyHall ? 'rules' : 'rulesSimple')

  for (let round = 1; round <= config.rounds; round++) {
    const prize = roundPrize(config, round, total, previous)
    const winner = randomCrate(random)
    const final = round === config.rounds

    // The lids are shut before any text changes
    act()
    await step(io.closeCrates())
    act()
    io.setCrates(
      Array.from({ length: crateCount }, (_, crate) =>
        crate === winner ? { text: amount(prize), kind: 'prize' } : { text: amount(0), kind: 'dud' },
      ),
    )
    io.setRound({ round, rounds: config.rounds, prize })
    io.setPhase('pick')
    cue('roundStart')
    await say(final ? 'finalRound' : 'round', { round, rounds: config.rounds, prize })
    await say('pick')

    act()
    const pick = await step(io.awaitPick())
    cue('pick')
    await say('picked', { pick: pick + 1 })

    let choice: Choice | null = null
    let chosen = pick
    if (montyHall) {
      const opened = hostOpens(pick, winner, random)
      act()
      io.setPhase('decide')
      await say('hostOpens', { opened: opened + 1 })
      act()
      io.openCrate(opened)
      cue('hostOpens')
      cue('dud')
      await say('offer', { pick: pick + 1, other: otherCrate(pick, opened) + 1 })

      act()
      choice = await step(io.awaitDecision())
      chosen = finalCrate(pick, opened, choice)
      cue(choice)
      await say(choice === 'stay' ? 'stayed' : 'switched', { final: chosen + 1 })
    }

    const won = chosen === winner
    const result: RoundResult = { round, prize, choice, won }
    act()
    io.recordRound(result)
    io.setPhase('reveal')

    await say('open')
    cue('drumroll')
    act()
    await step(io.wait(drumrollMs))
    act()
    io.openCrate(chosen)
    cue('reveal')
    if (won) {
      wins++
      total += prize
      cue('win')
      io.pose(winPoses[(wins - 1) % winPoses.length])
      await say('won', { prize })
    } else {
      losses++
      cue('lose')
      io.pose(losePoses[(losses - 1) % losePoses.length])
      await say('lost', { winner: winner + 1 })
    }
    // The rest open too, to show where the prize was
    act()
    for (let crate = 0; crate < crateCount; crate++) {
      if (crate !== chosen) io.openCrate(crate)
    }
    io.addToTab(result, total)
    io.setPhase('result')
    await say('total', { total })

    act()
    await step(io.awaitNext())
    cue('next')
    act()
    await step(io.closeCrates())
    previous = prize
  }

  const extra = bonus(config, total)
  if (extra) {
    cue('bonus')
    await say('bonus', { bonus: extra })
  }
  // The tab shows the final total before the host says it
  act()
  io.finish(total, extra)
  io.setPhase('finale')
  cue('finale')
  await say('finale', { total: total + extra })
  if (montyHall) await say('oddsFact')
  return total + extra
}
