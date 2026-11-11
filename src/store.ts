import { create } from 'zustand'
import { demoDefaults, validateConfig, type GameMode, type PrizeMode } from './game/config.ts'
import {
  runShow,
  type CrateKind,
  type CueName,
  type Phase,
  type PoseName,
  type RoundResult,
  type ShowIO,
} from './game/director.ts'
import { choiceForCrate, crateCount, finalCrate, type Choice } from './game/rules.ts'
import { formatAmount } from './game/script.ts'

export interface CrateState {
  text: string
  kind: CrateKind
  // Where the lid is headed
  open: boolean
  // The lid is closed and still, as the crate's frame loop last reported
  shut: boolean
}

// Each cue carries a fresh id, so a consumer reacts to it once, however often it renders
export interface Cue {
  name: CueName
  id: number
}
export interface PoseCue {
  pose: PoseName
  id: number
}
export interface SpokenLine {
  text: string
  id: number
}

// The player's input the show is waiting for, if any; any other input is ignored
export type Awaiting = 'pick' | 'decision' | 'next' | null

// What the leva Game folder chooses, applied at the next Start
export interface GameOptions {
  game: GameMode
  prizes: PrizeMode
  rounds: number
}

interface GameState {
  phase: Phase
  awaiting: Awaiting
  // The round in play, from 1, and its prize; 0 and null before the first
  round: number
  rounds: number
  prize: number | null
  currency: string
  crates: CrateState[]
  // Crates are numbered from 0: the first pick, the crate the host opened and the final choice
  picked: number | null
  opened: number | null
  final: number | null
  // The rounds the tab shows, after each is revealed, and the bonus at the finale
  tab: { rounds: RoundResult[]; total: number; bonus: number }
  // Every decided round, saved at the final choice, before its reveal
  results: RoundResult[]
  line: SpokenLine | null
  cue: Cue | null
  poseCue: PoseCue | null
  // The show has said its last line
  over: boolean
  options: GameOptions

  // The player's input
  start: () => void
  pick: (crate: number) => void
  decide: (choice: Choice | number) => void
  next: () => void
  skipLine: () => void
  playAgain: () => void
  // The page's own: the panel, the crates' frame loops and unmounting
  setOptions: (options: Partial<GameOptions>) => void
  reportShut: (crate: number) => void
  stop: () => void
}

// A line holds long enough to read: a moment, then a little longer for each character
const holdBaseMs = 900
const holdPerCharacterMs = 55

const initialCrates = (currency: string): CrateState[] =>
  Array.from({ length: crateCount }, () => ({
    text: formatAmount(0, currency),
    kind: 'dud',
    open: false,
    shut: true,
  }))

// Characters as a reader sees them, so an emoji or an accented letter counts once
const graphemes = new Intl.Segmenter()
const characters = (text: string) => [...graphemes.segment(text)].length

const demoCurrency = demoDefaults().currency

export const useGame = create<GameState>()((set, get) => {
  let ids = 0
  // The show running now, one per Start, stopped by Play again and by unmounting
  let show: AbortController | null = null
  // Each pending step's way to finish, cleared when it does or the show stops
  let onLine: (() => void) | null = null
  let onPick: ((crate: number) => void) | null = null
  let onDecision: ((choice: Choice) => void) | null = null
  let onNext: (() => void) | null = null
  let onShut: (() => void) | null = null
  const timers = new Set<ReturnType<typeof setTimeout>>()

  const later = (ms: number, done: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      done()
    }, ms)
    timers.add(timer)
    return timer
  }

  const allShut = () => get().crates.every((crate) => crate.shut)

  // Stops the show: its timers cleared and its pending steps dropped. The director has already
  // given up on them, as its signal aborted
  const halt = () => {
    show?.abort(new DOMException('The show was stopped', 'AbortError'))
    show = null
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    onLine = onPick = onDecision = onNext = onShut = null
  }

  const createIO = (signal: AbortSignal): ShowIO => {
    // A step of a show that has since stopped does nothing
    const live = () => !signal.aborted
    return {
      say: ({ text }) =>
        new Promise<void>((resolve) => {
          if (!live()) return
          set({ line: { text, id: ++ids } })
          const finish = () => {
            if (onLine !== finish) return
            clearTimeout(timer)
            timers.delete(timer)
            onLine = null
            resolve()
          }
          const timer = later(holdBaseMs + holdPerCharacterMs * characters(text), finish)
          onLine = finish
        }),
      wait: (ms) =>
        new Promise<void>((resolve) => {
          if (live()) later(ms, resolve)
        }),
      cue: (name) => {
        if (live()) set({ cue: { name, id: ++ids } })
      },
      pose: (pose) => {
        if (live()) set({ poseCue: { pose, id: ++ids } })
      },
      setPhase: (phase) => {
        if (live()) set({ phase })
      },
      setRound: ({ round, rounds, prize }) => {
        if (!live()) return
        set({ round, rounds, prize, picked: null, opened: null, final: null })
      },
      setCrates: (crates) => {
        if (!live()) return
        // The director closes the lids first; a text changed under an open lid would show
        if (!allShut()) throw new Error('A crate was set while a lid was open')
        set({ crates: crates.map((crate) => ({ ...crate, open: false, shut: true })) })
      },
      openCrate: (crate) => {
        if (!live()) return
        set((state) => ({
          crates: state.crates.map((c, i) => (i === crate ? { ...c, open: true, shut: false } : c)),
          // While the offer is being made, the crate opened is the host's
          ...(state.phase === 'decide' && state.opened === null ? { opened: crate } : {}),
        }))
      },
      closeCrates: () =>
        new Promise<void>((resolve) => {
          if (!live()) return
          set((state) => ({ crates: state.crates.map((c) => ({ ...c, open: false })) }))
          // Resolved by the lids themselves, never a timer: a hidden tab stops the frame loop
          // while timers run on
          if (allShut()) resolve()
          else onShut = resolve
        }),
      awaitPick: () =>
        new Promise<number>((resolve) => {
          if (!live()) return
          set({ awaiting: 'pick' })
          onPick = resolve
        }),
      awaitDecision: () =>
        new Promise<Choice>((resolve) => {
          if (!live()) return
          set({ awaiting: 'decision' })
          onDecision = resolve
        }),
      awaitNext: () =>
        new Promise<void>((resolve) => {
          if (!live()) return
          set({ awaiting: 'next' })
          onNext = resolve
        }),
      recordRound: (result) => {
        if (live()) set((state) => ({ results: [...state.results, result] }))
      },
      addToTab: (result, total) => {
        if (!live()) return
        set((state) => ({ tab: { ...state.tab, rounds: [...state.tab.rounds, result], total } }))
      },
      finish: (total, bonus) => {
        if (live()) set((state) => ({ tab: { ...state.tab, total: total + bonus, bonus } }))
      },
    }
  }

  return {
    phase: 'title',
    awaiting: null,
    round: 0,
    rounds: 0,
    prize: null,
    currency: demoCurrency,
    crates: initialCrates(demoCurrency),
    picked: null,
    opened: null,
    final: null,
    tab: { rounds: [], total: 0, bonus: 0 },
    results: [],
    line: null,
    cue: null,
    poseCue: null,
    over: false,
    options: { game: 'montyHall', prizes: 'pureOdds', rounds: demoDefaults().rounds },

    // Called from the Start click, never an effect, so a show can't start twice
    start: () => {
      if (get().phase !== 'title' || show) return
      const validation = validateConfig({ ...demoDefaults(), ...get().options }, 'demo')
      if (!validation.ok) {
        console.error('The game settings are invalid:', validation.errors.join(' '))
        return
      }
      const { config } = validation
      const controller = new AbortController()
      show = controller
      set({
        phase: 'intro',
        awaiting: null,
        round: 0,
        rounds: config.rounds,
        prize: null,
        currency: config.currency,
        picked: null,
        opened: null,
        final: null,
        tab: { rounds: [], total: 0, bonus: 0 },
        results: [],
        line: null,
        over: false,
      })
      runShow(config, createIO(controller.signal), {
        kind: 'demo',
        random: Math.random,
        signal: controller.signal,
      }).then(
        () => {
          if (show === controller) set({ over: true })
        },
        (error: unknown) => {
          if (!controller.signal.aborted) console.error('The show stopped:', error)
        },
      )
    },
    pick: (crate) => {
      if (!onPick || !Number.isInteger(crate) || crate < 0 || crate >= crateCount) return
      const done = onPick
      onPick = null
      set({ awaiting: null, picked: crate, final: crate })
      done(crate)
    },
    // A choice from the buttons, or a crate clicked while the offer stands
    decide: (input) => {
      const { picked, opened } = get()
      if (!onDecision || picked === null || opened === null) return
      const choice = typeof input === 'number' ? choiceForCrate(input, picked, opened) : input
      if (choice !== 'stay' && choice !== 'switch') return
      const done = onDecision
      onDecision = null
      set({ awaiting: null, final: finalCrate(picked, opened, choice) })
      done(choice)
    },
    next: () => {
      if (!onNext) return
      const done = onNext
      onNext = null
      set({ awaiting: null })
      done()
    },
    skipLine: () => {
      onLine?.()
    },
    playAgain: () => {
      if (!get().over) return
      halt()
      set((state) => ({
        phase: 'title',
        awaiting: null,
        line: null,
        over: false,
        picked: null,
        opened: null,
        final: null,
        crates: state.crates.map((c) => ({ ...c, open: false })),
      }))
    },
    setOptions: (options) => set((state) => ({ options: { ...state.options, ...options } })),
    reportShut: (crate) => {
      const state = get()
      if (state.crates[crate].open || state.crates[crate].shut) return
      set({ crates: state.crates.map((c, i) => (i === crate ? { ...c, shut: true } : c)) })
      if (onShut && allShut()) {
        const done = onShut
        onShut = null
        done()
      }
    },
    stop: () => {
      halt()
    },
  }
})
