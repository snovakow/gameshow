import { create } from 'zustand'
import type { CueName } from '../game/director.ts'
import { readStored, writeStored } from '../storage.ts'

// Safari's audio session (iOS 17 and later), which TypeScript's DOM types don't have yet. Its
// 'playback' type plays through the silent switch, as a video does, and pauses other audio
declare global {
  interface Navigator {
    readonly audioSession?: AudioSession
  }
  interface AudioSession {
    type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'
  }
}

// Each sound follows one of the panel's volume controls
export type Category = 'crowd' | 'stings' | 'bed'
export const categories: readonly Category[] = ['crowd', 'stings', 'bed']

const soundNames = ['applause', 'cheer', 'bigCheer', 'ooh', 'aww', 'drumroll', 'crash', 'murmur'] as const
type SoundName = (typeof soundNames)[number]

// How a file in public/audio plays, from sounds.json: the part of the file heard (from offset,
// for duration, in seconds), its fades, its level, and whether it loops over that part
interface Sound {
  file: string
  category: Category
  offset: number
  duration: number
  fadeIn: number
  fadeOut: number
  gain: number
  loop: boolean
}

// What each cue plays and stops. A cue with no row is silent
const cueSounds: Partial<Record<CueName, { play?: SoundName[]; stop?: SoundName[] }>> = {
  showStart: { play: ['applause', 'murmur'] },
  dud: { play: ['ooh'] },
  drumroll: { play: ['drumroll'] },
  reveal: { stop: ['drumroll'] },
  win: { play: ['crash', 'cheer', 'applause'] },
  lose: { play: ['aww'] },
  finale: { play: ['bigCheer'], stop: ['murmur'] },
}

// Decoded at this rate, the rate most phones play at, so they needn't resample as they play
const decodeRate = 48000
// Long enough to hide a click, short enough to read as at once
const declickSeconds = 0.03
// How quickly everything goes quiet when the show goes back to its title
const stopAllSeconds = 0.3

const mutedKey = 'gameshow:muted'

interface SoundSettings {
  muted: boolean
  volumes: Record<Category, number>
  toggleMuted: () => void
  setVolume: (category: Category, volume: number) => void
}

// The mute button and the panel's volumes. Mute is remembered in this browser, if it lets us
export const useSound = create<SoundSettings>()((set) => ({
  muted: readStored('local', mutedKey) === '1',
  volumes: { crowd: 1, stings: 1, bed: 1 },
  toggleMuted: () =>
    set((state) => {
      const muted = !state.muted
      writeStored('local', mutedKey, muted ? '1' : '0')
      return { muted }
    }),
  setVolume: (category, volume) =>
    set((state) => ({ volumes: { ...state.volumes, [category]: volume } })),
}))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isName = (value: string): value is SoundName => soundNames.some((name) => name === value)
const isCategory = (value: unknown): value is Category =>
  categories.some((category) => category === value)
const isSeconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

// The manifest's sounds, each checked, so a mistake there silences that sound alone
function readManifest(json: unknown): Map<SoundName, Sound> {
  const sounds = new Map<SoundName, Sound>()
  if (!isRecord(json) || !isRecord(json.sounds)) return sounds
  for (const [name, entry] of Object.entries(json.sounds)) {
    if (!isName(name) || !isRecord(entry)) continue
    const { file, category, offset, duration, fadeIn, fadeOut, gain, loop } = entry
    if (
      typeof file !== 'string' ||
      !isCategory(category) ||
      !isSeconds(offset) ||
      !isSeconds(duration) ||
      !isSeconds(fadeIn) ||
      !isSeconds(fadeOut) ||
      !isSeconds(gain) ||
      typeof loop !== 'boolean' ||
      // A one-shot's fades are scheduled one after the other
      (!loop && fadeIn + fadeOut > duration)
    ) {
      console.warn(`The sound "${name}" is described wrongly in sounds.json`)
      continue
    }
    sounds.set(name, { file, category, offset, duration, fadeIn, fadeOut, gain, loop })
  }
  return sounds
}

const sounds = new Map<SoundName, { sound: Sound; buffer: AudioBuffer }>()
let loading: Promise<void> | null = null

// Fetches and decodes every sound, once per page. An OfflineAudioContext decodes them: it plays
// nothing, so no autoplay rule applies, and what it decodes plays in any context. A sound that
// fails to load stays silent
export function loadSounds(): Promise<void> {
  loading ??= (async () => {
    if (typeof OfflineAudioContext === 'undefined') return
    const base = `${import.meta.env.BASE_URL}audio/`
    const response = await fetch(`${base}sounds.json`)
    const manifest = readManifest(await response.json())
    const decoder = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: decodeRate })
    await Promise.all(
      [...manifest].map(async ([name, sound]) => {
        try {
          const file = await fetch(`${base}${sound.file}`)
          if (!file.ok) throw new Error(`${file.status} ${file.statusText}`)
          const buffer = await decoder.decodeAudioData(await file.arrayBuffer())
          sounds.set(name, { sound, buffer })
        } catch (error) {
          console.warn(`The sound "${name}" didn't load:`, error)
        }
      }),
    )
  })().catch((error: unknown) => {
    console.warn("The show's sounds didn't load:", error)
  })
  return loading
}

interface Voice {
  source: AudioBufferSourceNode
  level: GainNode
}

interface Output {
  context: AudioContext
  master: GainNode
  groups: Record<Category, GainNode>
}

let output: Output | null = null
const playing = new Map<SoundName, Set<Voice>>()

// Eases a level to its new value rather than stepping, which would click
function ease(param: AudioParam, value: number, context: BaseAudioContext) {
  param.setTargetAtTime(value, context.currentTime, declickSeconds / 3)
}

function applySettings({ muted, volumes }: Pick<SoundSettings, 'muted' | 'volumes'>) {
  if (!output) return
  ease(output.master.gain, muted ? 0 : 1, output.context)
  for (const category of categories) ease(output.groups[category].gain, volumes[category], output.context)
}

// Called from the Start click, the press browsers want before a page makes a sound. It sets the
// audio session first, so the context it then makes plays through an iPhone's silent switch.
// One context serves the page; a later Start wakes it if the browser suspended it
export function startAudio() {
  if (output) {
    if (output.context.state !== 'running') void output.context.resume()
    return
  }
  if (typeof AudioContext === 'undefined') return
  if (navigator.audioSession) navigator.audioSession.type = 'playback'
  const context = new AudioContext({ latencyHint: 'interactive' })
  const master = context.createGain()
  master.connect(context.destination)
  const group = () => {
    const gain = context.createGain()
    gain.connect(master)
    return gain
  }
  output = { context, master, groups: { crowd: group(), stings: group(), bed: group() } }
  const { muted, volumes } = useSound.getState()
  master.gain.value = muted ? 0 : 1
  for (const category of categories) output.groups[category].gain.value = volumes[category]
  useSound.subscribe(applySettings)
  // A phone suspends the sound while the page is hidden or a call comes in, and leaves it so
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && context.state !== 'running') void context.resume()
  })
  void context.resume()
}

function play(name: SoundName) {
  const loaded = sounds.get(name)
  if (!output || !loaded) return
  const { sound, buffer } = loaded
  // A loop already running carries on
  if (sound.loop && playing.get(name)?.size) return
  const { context } = output
  const now = context.currentTime
  const source = context.createBufferSource()
  source.buffer = buffer
  const level = context.createGain()
  level.gain.setValueAtTime(0, now)
  level.gain.linearRampToValueAtTime(sound.gain, now + sound.fadeIn)
  source.connect(level).connect(output.groups[sound.category])
  if (sound.loop) {
    source.loop = true
    source.loopStart = sound.offset
    source.loopEnd = sound.offset + sound.duration
    source.start(now, sound.offset)
  } else {
    const end = now + sound.duration
    level.gain.setValueAtTime(sound.gain, end - sound.fadeOut)
    level.gain.linearRampToValueAtTime(0, end)
    source.start(now, sound.offset, sound.duration)
  }
  const voice = { source, level }
  const voices = playing.get(name) ?? new Set<Voice>()
  voices.add(voice)
  playing.set(name, voices)
  source.addEventListener('ended', () => {
    voices.delete(voice)
    level.disconnect()
  })
}

// Fades a sound out from wherever it is, by its own fade unless a quicker one is asked for
function stop(name: SoundName, seconds?: number) {
  const voices = playing.get(name)
  const loaded = sounds.get(name)
  if (!output || !voices || !loaded) return
  const fade = Math.max(declickSeconds, seconds ?? loaded.sound.fadeOut)
  const now = output.context.currentTime
  for (const voice of voices) {
    const { source, level } = voice
    level.gain.cancelScheduledValues(now)
    level.gain.setValueAtTime(level.gain.value, now)
    level.gain.linearRampToValueAtTime(0, now + fade)
    source.stop(now + fade)
    // Fading out, it no longer counts as playing, so a loop asked for again starts afresh
    voices.delete(voice)
  }
}

export function playCue(cue: CueName) {
  const row = cueSounds[cue]
  for (const name of row?.stop ?? []) stop(name)
  for (const name of row?.play ?? []) play(name)
}

// The show went back to its title: nothing plays on over the title card
export function stopAll() {
  for (const name of playing.keys()) stop(name, stopAllSeconds)
}
