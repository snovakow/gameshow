import {
  formatAmount,
  lineKeys,
  unknownPlaceholders,
  type LineKey,
  type LineOverrides,
  type ShowKind,
} from './script.ts'

// Monty Hall: the host opens an empty crate and offers a switch. Simple: one pick, win or lose
export type GameMode = 'montyHall' | 'simple'
// Pure odds: a fixed ladder of prizes. Within range: each prize set from the tab so far, so the
// total lands between the min and the max
export type PrizeMode = 'pureOdds' | 'withinRange'

export interface Config {
  // The recipient, needed for a gift
  name: string
  // Who the gift is from, optional
  from: string
  occasion: string
  game: GameMode
  prizes: PrizeMode
  rounds: number
  // Whole amounts in the currency: the total aimed for, and in within-range mode the least and
  // the most a show can end on
  target: number
  min: number
  max: number
  // Every prize is a multiple of the step
  step: number
  currency: string
  lines: LineOverrides
}

// Lengths count characters as a person sees them, so an accented letter or € counts once
export const limits = {
  name: 40,
  from: 40,
  occasion: 30,
  currency: 3,
  rounds: 10,
  // A link this long still pastes into a message whole
  link: 4000,
}

// The link's own format version, which every later version of the app keeps reading
export const linkVersion = 1

// The demo: the classic game on a fixed ladder of 10 to 50. Its min and max are unused in pure
// odds and are a gift's, so switching the demo to within range plays a valid game
export function demoDefaults(): Config {
  return {
    name: '',
    from: '',
    occasion: 'birthday',
    game: 'montyHall',
    prizes: 'pureOdds',
    rounds: 5,
    target: 100,
    min: 60,
    max: 140,
    step: 5,
    currency: '$',
    lines: {},
  }
}

// Where a new gift on the setup page starts; the giver adds the name
export function giftDefaults(): Config {
  return { ...demoDefaults(), prizes: 'withinRange' }
}

// What the link carries, the host's lines holding only the giver's own
export function linkPayload(config: Config) {
  return {
    v: linkVersion,
    name: config.name,
    from: config.from,
    occasion: config.occasion,
    game: config.game,
    prizes: config.prizes,
    rounds: config.rounds,
    target: config.target,
    min: config.min,
    max: config.max,
    step: config.step,
    currency: config.currency,
    lines: config.lines,
  }
}

// The link's base64url text without padding: four characters for every three bytes of the
// payload's UTF-8 JSON, rounded up
export function encodedLength(config: Config): number {
  const bytes = new TextEncoder().encode(JSON.stringify(linkPayload(config))).length
  return Math.ceil((bytes * 4) / 3)
}

export type Validation = { ok: true; config: Config } | { ok: false; errors: string[] }

// Graphemes, so an emoji or a letter with its accent counts once
const graphemes = new Intl.Segmenter()
const characters = (text: string) => [...graphemes.segment(text)].length
const isWhole = (value: unknown): value is number => Number.isSafeInteger(value)
const lineKeySet: ReadonlySet<string> = new Set(lineKeys)
const isLineKey = (key: string): key is LineKey => lineKeySet.has(key)
const gameModes: ReadonlySet<string> = new Set<GameMode>(['montyHall', 'simple'])
const isGameMode = (value: unknown): value is GameMode =>
  typeof value === 'string' && gameModes.has(value)
const prizeModes: ReadonlySet<string> = new Set<PrizeMode>(['pureOdds', 'withinRange'])
const isPrizeMode = (value: unknown): value is PrizeMode =>
  typeof value === 'string' && prizeModes.has(value)

// Checks settings from anywhere, a decoded link or the setup page's form, and returns them
// trimmed and typed, or every problem in words a giver can act on
export function validateConfig(input: unknown, kind: ShowKind): Validation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['The settings are missing.'] }
  }
  const fields = new Map<string, unknown>(Object.entries(input))
  const errors: string[] = []

  const text = (key: string, label: string, max: number, needed: boolean) => {
    const value = fields.get(key)
    if (typeof value !== 'string') {
      errors.push(`${label} must be text.`)
      return ''
    }
    const trimmed = value.trim()
    if (needed && !trimmed) errors.push(`${label} is needed.`)
    else if (characters(trimmed) > max) errors.push(`${label} must be at most ${max} characters.`)
    return trimmed
  }
  const name = text('name', 'Name', limits.name, kind === 'gift')
  const from = text('from', 'From', limits.from, false)
  const occasion = text('occasion', 'Occasion', limits.occasion, true)

  const currencyInput = fields.get('currency')
  const currency = typeof currencyInput === 'string' ? currencyInput.trim() : ''
  if (characters(currency) < 1 || characters(currency) > limits.currency) {
    errors.push(`Currency must be 1 to ${limits.currency} characters.`)
  }

  const game = fields.get('game')
  if (!isGameMode(game)) errors.push('Game mode must be Monty Hall or simple.')
  const prizes = fields.get('prizes')
  if (!isPrizeMode(prizes)) errors.push('Prize mode must be pure odds or within range.')

  const rounds = fields.get('rounds')
  const roundsValid = isWhole(rounds) && rounds >= 1 && rounds <= limits.rounds
  if (!roundsValid) errors.push(`Rounds must be a whole number from 1 to ${limits.rounds}.`)

  const step = fields.get('step')
  const stepValid = isWhole(step) && step >= 1
  if (!stepValid) errors.push('Step must be a whole number of at least 1.')

  // Each amount is checked against the step only when the step itself is valid, so one mistake
  // gives one message
  const amount = (key: string, label: string, least: number) => {
    const value = fields.get(key)
    if (!isWhole(value) || value < least) {
      errors.push(`${label} must be a whole number of at least ${least}.`)
      return null
    }
    if (stepValid && value % step !== 0) errors.push(`${label} must be a multiple of the step.`)
    return value
  }
  const target = amount('target', 'Target', stepValid ? step : 1)
  // The min and max play only in within-range mode, but the link carries them in both
  const withinRange = prizes === 'withinRange'
  const min = withinRange ? amount('min', 'Min', 0) : fields.get('min')
  const max = withinRange ? amount('max', 'Max', 0) : fields.get('max')
  if (!withinRange && (!isWhole(min) || !isWhole(max) || min < 0 || max < 0)) {
    errors.push('Min and max must be whole numbers of at least 0.')
  }
  if (withinRange && isWhole(min) && isWhole(max) && target !== null) {
    if (min > target) errors.push("Min can't be above the target.")
    if (max < target) errors.push("Max can't be below the target.")
    // Every round pays at least the step, so the max must leave room for that many steps
    if (roundsValid && stepValid && max < rounds * step) {
      errors.push(`Max must be at least the rounds times the step, ${rounds * step}.`)
    }
  }

  const lines: Partial<Record<LineKey, string[]>> = {}
  const linesInput = fields.get('lines')
  if (typeof linesInput !== 'object' || linesInput === null || Array.isArray(linesInput)) {
    errors.push("The host's lines must be a set of lists.")
  } else {
    for (const [key, variants] of Object.entries(linesInput)) {
      if (!isLineKey(key)) {
        errors.push(`There's no host line called "${key}".`)
        continue
      }
      const list: unknown = variants
      if (!Array.isArray(list) || !list.every((variant) => typeof variant === 'string')) {
        errors.push(`The host's line "${key}" must be a list of text.`)
        continue
      }
      // A blank variant keeps nothing, and a key left with none keeps its default
      const kept = list.map((variant) => variant.trim()).filter(Boolean)
      for (const variant of kept) {
        for (const unknown of unknownPlaceholders(variant)) {
          errors.push(`The host's line "${key}" uses {${unknown}}, which isn't a placeholder.`)
        }
      }
      if (kept.length) lines[key] = kept
    }
  }

  if (
    errors.length ||
    !isGameMode(game) ||
    !isPrizeMode(prizes) ||
    !isWhole(rounds) ||
    !isWhole(step) ||
    !isWhole(target) ||
    !isWhole(min) ||
    !isWhole(max)
  ) {
    return { ok: false, errors }
  }
  const config: Config = {
    name,
    from,
    occasion,
    game,
    prizes,
    rounds,
    target,
    min,
    max,
    step,
    currency,
    lines,
  }
  if (encodedLength(config) > limits.link) {
    return {
      ok: false,
      errors: [
        `The link would be longer than ${formatAmount(limits.link, '')} characters; shorten the host's lines.`,
      ],
    }
  }
  return { ok: true, config }
}
