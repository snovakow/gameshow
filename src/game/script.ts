// The host's lines: each key holds a list of variants, taken in turn, so a line said every round
// doesn't repeat word for word

export type LineKey =
  | 'title'
  | 'welcome'
  | 'rules'
  | 'rulesSimple'
  | 'round'
  | 'finalRound'
  | 'pick'
  | 'picked'
  | 'hostOpens'
  | 'offer'
  | 'stayed'
  | 'switched'
  | 'open'
  | 'won'
  | 'lost'
  | 'total'
  | 'bonus'
  | 'finale'
  | 'oddsFact'

export const lineKeys: readonly LineKey[] = [
  'title',
  'welcome',
  'rules',
  'rulesSimple',
  'round',
  'finalRound',
  'pick',
  'picked',
  'hostOpens',
  'offer',
  'stayed',
  'switched',
  'open',
  'won',
  'lost',
  'total',
  'bonus',
  'finale',
  'oddsFact',
]

// The gift's own words, set once for the whole show
type TextPlaceholder = 'name' | 'from' | 'occasion'
// Money, shown with the gift's currency
type AmountPlaceholder = 'prize' | 'total' | 'bonus'
// Round numbers, and crate numbers as the player sees them, from 1
type CountPlaceholder = 'round' | 'rounds' | 'pick' | 'opened' | 'other' | 'final' | 'winner'
export type Placeholder = TextPlaceholder | AmountPlaceholder | CountPlaceholder

export const placeholders: readonly Placeholder[] = [
  'name',
  'from',
  'occasion',
  'round',
  'rounds',
  'prize',
  'total',
  'bonus',
  'pick',
  'opened',
  'other',
  'final',
  'winner',
]

const amountPlaceholders: ReadonlySet<string> = new Set<AmountPlaceholder>(['prize', 'total', 'bonus'])
const placeholderSet: ReadonlySet<string> = new Set(placeholders)

function isPlaceholder(name: string): name is Placeholder {
  return placeholderSet.has(name)
}

export type Lines = Readonly<Record<LineKey, readonly string[]>>
// A giver's own variants for the keys they changed; every other key keeps its default
export type LineOverrides = Readonly<Partial<Record<LineKey, readonly string[]>>>

// A gift plays these; each list that uses {from} also has a variant without it, for a gift
// that doesn't say who it's from
export const giftLines: Lines = {
  title: ['Happy {occasion}, {name}! Your show is ready.'],
  welcome: ['Happy {occasion}, {name}! Welcome to your very own game show!'],
  rules: [
    "One of these crates holds the prize. Pick one, and I'll open an empty one. Then you can stay or switch!",
  ],
  rulesSimple: ['Pick the right crate and the prize is yours!'],
  round: ['Round {round} of {rounds}, for {prize}!'],
  finalRound: ['The final round, for {prize}!'],
  pick: ['Pick a crate!'],
  picked: ['Crate {pick}! Good choice.'],
  hostOpens: ["Let me show you what's in crate {opened}…"],
  offer: ['Empty! Stay with crate {pick}, or switch to crate {other}?'],
  stayed: ['Sticking with crate {final}!'],
  switched: ['Switching to crate {final}!'],
  open: ["Let's open it…"],
  won: ['You won {prize}!'],
  lost: ['Oh no! It was in crate {winner}.'],
  total: ['That brings your tab to {total}.'],
  bonus: ["Because it's your {occasion}, here's a bonus of {bonus}!"],
  finale: [
    "{name}, you're going home with {total}! Happy {occasion}, from {from}!",
    "{name}, you're going home with {total}! Happy {occasion}!",
  ],
  oddsFact: ["Here's the secret: switching wins two times in three!"],
}

// The demo has no recipient, so it drops the name, and the occasion where it greets them; its
// title is empty, so the title card shows the button alone
export const demoLines: Lines = {
  ...giftLines,
  title: [''],
  welcome: ['Welcome to your very own game show!'],
  finale: ["You're going home with {total}!"],
}

export type ShowKind = 'demo' | 'gift'

// What a script reads from the show's settings, which a config provides as it is
export interface ScriptSettings {
  name: string
  from: string
  occasion: string
  currency: string
  lines: LineOverrides
}

// What a line is told at the moment it's said
export type LineValues = Readonly<Partial<Record<AmountPlaceholder | CountPlaceholder, number>>>

// Says a line: the next usable variant of the key, filled in
export type Script = (key: LineKey, values?: LineValues) => string

// A placeholder is a word in braces; anything else in braces is a typo the giver should see
const placeholderPattern = /\{([^{}]*)\}/g

// Each name in braces that isn't a placeholder, in order, once each
export function unknownPlaceholders(template: string): string[] {
  const unknown = new Set<string>()
  for (const [, name] of template.matchAll(placeholderPattern)) {
    if (!isPlaceholder(name)) unknown.add(name)
  }
  return [...unknown]
}

// Currency first and comma thousands, written out here rather than by a locale, so every
// browser and Node show the same text
export function formatAmount(amount: number, currency: string): string {
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${amount < 0 ? '-' : ''}${currency}${digits}`
}

function fill(template: string, texts: ReadonlyMap<string, string>): string {
  return template.replace(placeholderPattern, (token, name: string) => texts.get(name) ?? token)
}

// A variant is usable when every placeholder in it has something to say: a gift without a
// "from" skips the variants that name it
function usable(template: string, texts: ReadonlyMap<string, string>): boolean {
  for (const [, name] of template.matchAll(placeholderPattern)) {
    if (isPlaceholder(name) && !texts.get(name)) return false
  }
  return true
}

export function createScript(settings: ScriptSettings, kind: ShowKind): Script {
  const defaults = kind === 'gift' ? giftLines : demoLines
  // The next variant to try, per key
  const turns = new Map<LineKey, number>()

  const nextUsable = (
    key: LineKey,
    variants: readonly string[] | undefined,
    texts: ReadonlyMap<string, string>,
  ) => {
    if (!variants) return undefined
    const start = turns.get(key) ?? 0
    for (let i = 0; i < variants.length; i++) {
      const index = (start + i) % variants.length
      if (usable(variants[index], texts)) {
        turns.set(key, index + 1)
        return variants[index]
      }
    }
    return undefined
  }

  return (key, values = {}) => {
    const texts = new Map<string, string>([
      ['name', settings.name],
      ['from', settings.from],
      ['occasion', settings.occasion],
    ])
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) continue
      texts.set(
        name,
        amountPlaceholders.has(name) ? formatAmount(value, settings.currency) : String(value),
      )
    }
    // The giver's variants first; when none of them can be said, the default's
    const template =
      nextUsable(key, settings.lines[key], texts) ?? nextUsable(key, defaults[key], texts)
    // Only a line asked for without the values it needs reaches here, and it still says
    // something rather than nothing
    return fill(template ?? defaults[key][0], texts)
  }
}
