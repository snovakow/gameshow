import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  giftDefaults,
  limits,
  validateConfig,
  type Config,
  type GameMode,
  type PrizeMode,
} from '../game/config.ts'
import { encodeLink, giftHash, progressKey } from '../game/link.ts'
import { simulate, type Outcomes } from '../game/prizes.ts'
import { parseProgress } from '../game/progress.ts'
import { mulberry32 } from '../game/random.ts'
import { formatAmount, giftLines, lineKeys, placeholders, type LineKey } from '../game/script.ts'
import { fontUrl } from '../stage/materials.ts'
import { readStored, removeStored, writeStored } from '../storage.ts'

// The form as typed, every field kept as its text so a half-typed number stays as it is
interface Draft {
  name: string
  from: string
  occasion: string
  game: GameMode
  prizes: PrizeMode
  rounds: string
  target: string
  min: string
  max: string
  step: string
  currency: string
  // One variant per line; a key left blank keeps the host's own words
  lines: Partial<Record<LineKey, string>>
}

type TextField = Exclude<keyof Draft, 'game' | 'prizes' | 'lines'>

const textFields: readonly TextField[] = [
  'name',
  'from',
  'occasion',
  'rounds',
  'target',
  'min',
  'max',
  'step',
  'currency',
]

// The draft lives in this tab's session, so going Back from a trial run finds the form as it was
const draftKey = 'gameshow:setup-draft'

// The preview plays this many shows per strategy: enough that its least and most are the ones a
// player will meet, quick enough to rerun on every keystroke
const previewGames = 20000
// A fixed seed, so the preview holds still while the giver types something that doesn't change it
const previewSeed = 1

// How each of the host's lines is named on the form, in the order the show says them
const lineLabels: Record<LineKey, string> = {
  title: 'Title card',
  welcome: 'Welcome',
  rules: 'The rules, Monty Hall',
  rulesSimple: 'The rules, simple game',
  round: 'Each round',
  finalRound: 'The final round',
  pick: 'Asking for a pick',
  picked: 'After the pick',
  hostOpens: 'Opening an empty crate',
  offer: 'The offer',
  stayed: 'Staying',
  switched: 'Switching',
  open: 'Before the reveal',
  won: 'A win',
  lost: 'A loss',
  total: 'The tab',
  bonus: 'The bonus',
  finale: 'The finale',
  oddsFact: 'The secret, Monty Hall',
}

function draftFrom(config: Config): Draft {
  return {
    name: config.name,
    from: config.from,
    occasion: config.occasion,
    game: config.game,
    prizes: config.prizes,
    rounds: String(config.rounds),
    target: String(config.target),
    min: String(config.min),
    max: String(config.max),
    step: String(config.step),
    currency: config.currency,
    lines: {},
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// The draft this tab kept, field by field over a new gift's defaults, so a value from an older
// form or one that fails to parse never breaks the page
function readDraft(): Draft {
  const draft = draftFrom(giftDefaults())
  let saved: unknown
  try {
    saved = JSON.parse(readStored('session', draftKey) ?? 'null')
  } catch {
    return draft
  }
  if (!isRecord(saved)) return draft
  for (const field of textFields) {
    const value = saved[field]
    if (typeof value === 'string') draft[field] = value
  }
  if (saved.game === 'montyHall' || saved.game === 'simple') draft.game = saved.game
  if (saved.prizes === 'pureOdds' || saved.prizes === 'withinRange') draft.prizes = saved.prizes
  const lines = saved.lines
  if (isRecord(lines)) {
    for (const key of lineKeys) {
      const text = lines[key]
      if (typeof text === 'string') draft.lines[key] = text
    }
  }
  return draft
}

// A whole number as typed; anything else is passed on as text, for validation to name
function whole(text: string): unknown {
  const trimmed = text.trim()
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed
}

function settingsFrom(draft: Draft) {
  const lines: Partial<Record<LineKey, string[]>> = {}
  for (const key of lineKeys) {
    const text = draft.lines[key]
    if (text?.trim()) lines[key] = text.split('\n')
  }
  return {
    name: draft.name,
    from: draft.from,
    occasion: draft.occasion,
    game: draft.game,
    prizes: draft.prizes,
    rounds: whole(draft.rounds),
    target: whole(draft.target),
    min: whole(draft.min),
    max: whole(draft.max),
    step: whole(draft.step),
    currency: draft.currency,
    lines,
  }
}

// The characters the typeface the stage draws its 3D text with has, read from the font itself
function useGlyphs() {
  const [glyphs, setGlyphs] = useState<ReadonlySet<string> | null>(null)
  useEffect(() => {
    let live = true
    fetch(fontUrl)
      .then((response) => response.json())
      .then((font: unknown) => {
        if (!live || !isRecord(font) || !isRecord(font.glyphs)) return
        setGlyphs(new Set(Object.keys(font.glyphs)))
      })
      // Without the font, nothing can be checked, and the page says nothing rather than guess
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return glyphs
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

function RadioGroup<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string
  name: string
  value: T
  options: [T, string, string][]
  onChange: (value: T) => void
}) {
  return (
    <div className="choices" role="radiogroup" aria-label={label}>
      <span className="label">{label}</span>
      {options.map(([option, title, hint]) => (
        <label key={option} className="choice">
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <span>
            <span className="label">{title}</span>
            <span className="hint">{hint}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function Preview({ config }: { config: Config }) {
  const amount = (value: number) => formatAmount(value, config.currency)
  // Keyed on the settings that set the prizes, so a change of name doesn't replay 40,000 shows
  const { game, prizes, rounds, target, min, max, step } = config
  const columns = useMemo(() => {
    const settings = { game, prizes, rounds, target, min, max, step }
    const run = (strategy: 'switch' | 'stay'): Outcomes =>
      simulate(settings, strategy, previewGames, mulberry32(previewSeed))
    const played: [string, Outcomes][] =
      game === 'montyHall'
        ? [
            ['Always switching', run('switch')],
            ['Always staying', run('stay')],
          ]
        : [['Any pick', run('switch')]]
    return played
  }, [game, prizes, rounds, target, min, max, step])

  const rows: [string, (outcomes: Outcomes) => string][] = [
    ['Least', (o) => amount(o.least)],
    ['Most', (o) => amount(o.most)],
    ['Average', (o) => amount(Math.round(o.average))],
    ['Middle 80%', (o) => `${amount(o.p10)} to ${amount(o.p90)}`],
  ]
  if (prizes === 'withinRange') {
    rows.push(['Bonus paid', (o) => `${Math.round(o.bonusRate * 100)}% of shows`])
  }
  const ladder = columns[0][1].ladder

  return (
    <section className="preview" data-setup="preview">
      <h2>What to expect</h2>
      <p className="hint">
        From {formatAmount(previewGames, '')} shows played by the rules for each way of playing.
      </p>
      <table>
        <thead>
          <tr>
            <th />
            {columns.map(([label]) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} data-setup={label}>
              <th scope="row">{label}</th>
              {columns.map(([column, outcomes]) => (
                <td key={column}>{value(outcomes)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {ladder && (
        <p data-setup="ladder">
          The prizes, round by round: {ladder.map(amount).join(', ')}
        </p>
      )}
    </section>
  )
}

// What this browser has kept for the link, and the way to forget it here
function SavedProgress({ payload, config }: { payload: string; config: Config }) {
  const key = progressKey(payload)
  // Read fresh on each render; the count makes Forget render again
  const [, setForgets] = useState(0)
  const stored = readStored('local', key)
  const progress = parseProgress(stored, config)
  let status = 'This browser has no progress for this link.'
  if (progress?.finished) status = 'This browser has played this link to the end.'
  else if (progress) {
    status = `This browser has played ${progress.results.length} of ${config.rounds} rounds of this link.`
  }

  return (
    <div className="saved">
      <p data-setup="saved">{status}</p>
      <button
        type="button"
        className="secondary"
        data-setup="forget"
        disabled={stored === null}
        onClick={() => {
          removeStored('local', key)
          setForgets((count) => count + 1)
        }}
      >
        Forget this link's progress
      </button>
      <p className="hint">Each browser keeps its own; this forgets it in this one only.</p>
    </div>
  )
}

function LinkPanel({ payload, config }: { payload: string; config: Config }) {
  const link = `${location.origin}${location.pathname}${giftHash(payload)}`
  const field = useRef<HTMLTextAreaElement>(null)
  // How the link was last copied, which says nothing once the link has changed
  const [copied, setCopied] = useState<{ link: string; how: 'copied' | 'selected' } | null>(null)
  const how = copied?.link === link ? copied.how : null

  // The clipboard where there is one; a page served over plain HTTP has none, so the link is
  // selected instead, for the giver to copy themselves
  const copy = async () => {
    if ('clipboard' in navigator) {
      try {
        await navigator.clipboard.writeText(link)
        setCopied({ link, how: 'copied' })
        return
      } catch {
        // Refused: fall through to selecting it
      }
    }
    const text = field.current
    if (!text) return
    text.focus()
    text.setSelectionRange(0, text.value.length)
    setCopied({ link, how: 'selected' })
  }

  return (
    <>
      <textarea
        ref={field}
        className="link"
        data-setup="link"
        readOnly
        rows={3}
        value={link}
        aria-label="The gift link"
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="actions">
        <button type="button" data-setup="copy" onClick={() => void copy()}>
          Copy the link
        </button>
        {/* A change of fragment reloads the page into the show; Back returns to this form */}
        <a className="button secondary" data-setup="try" href={giftHash(payload, true)}>
          Try it (doesn't count)
        </a>
      </div>
      <p className="hint" data-setup="copied" aria-live="polite">
        {how === 'copied' && 'Copied. Send it however you like.'}
        {how === 'selected' && 'Selected. Copy it with your keyboard or the menu.'}
      </p>
      <SavedProgress payload={payload} config={config} />
    </>
  )
}

// The gift maker: every setting with live checks, a preview of how shows tend to end, the link,
// a trial run that leaves no progress, and a warning where the stage can't draw the currency.
// Plain page, no stage
export function Setup() {
  const [draft, setDraft] = useState(readDraft)
  const glyphs = useGlyphs()
  useEffect(() => {
    writeStored('session', draftKey, JSON.stringify(draft))
  }, [draft])

  const validation = useMemo(() => validateConfig(settingsFrom(draft), 'gift'), [draft])
  const config = validation.ok ? validation.config : null
  const payload = useMemo(() => (config ? encodeLink(config) : null), [config])

  const update = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }))
  const text = (field: TextField, extra: { inputMode?: 'numeric' } = {}) => (
    <input
      type="text"
      name={field}
      data-setup={field}
      value={draft[field]}
      autoComplete="off"
      {...extra}
      onChange={(event) => update({ [field]: event.target.value })}
    />
  )
  const number = (field: TextField) => text(field, { inputMode: 'numeric' })

  // The stage draws prize amounts in 3D, currency first, with a typeface that shows ? for a
  // character it lacks; the tab and the host's lines are text and show anything
  const missing = glyphs ? [...new Set(draft.currency.trim())].filter((c) => !glyphs.has(c)) : []
  const withinRange = draft.prizes === 'withinRange'
  const montyHall = draft.game === 'montyHall'

  return (
    <main className="page setup" data-setup="page">
      <h1>Make a show as a gift</h1>
      <p>
        Choose who it's for and how it plays, then send the link. Everything is in the link itself,
        so nothing is stored anywhere but the browser that plays it.
      </p>

      <section>
        <h2>Who it's for</h2>
        <Field label="Their name" hint={`Up to ${limits.name} characters.`}>
          {text('name')}
        </Field>
        <Field label="From" hint="Optional: who the gift is from.">
          {text('from')}
        </Field>
        <Field label="The occasion" hint={'As in "Happy birthday".'}>
          {text('occasion')}
        </Field>
      </section>

      <section>
        <h2>The game</h2>
        <RadioGroup
          label="How it plays"
          name="game"
          value={draft.game}
          options={[
            ['montyHall', 'Monty Hall', 'The host opens an empty crate and offers a switch.'],
            ['simple', 'Simple', 'One pick, one in three to win.'],
          ]}
          onChange={(game) => update({ game })}
        />
        <RadioGroup
          label="How the prizes are set"
          name="prizes"
          value={draft.prizes}
          options={[
            [
              'withinRange',
              'Within range',
              'Prizes are set as the show goes, so the total lands between the min and the max, with a bonus if it falls short.',
            ],
            ['pureOdds', 'Pure odds', 'A fixed ladder of prizes; the total is down to luck.'],
          ]}
          onChange={(prizes) => update({ prizes })}
        />
        <Field label="Rounds" hint={`1 to ${limits.rounds}.`}>
          {number('rounds')}
        </Field>
      </section>

      <section>
        <h2>The money</h2>
        <Field label="Currency" hint={`Up to ${limits.currency} characters, shown before each amount.`}>
          {text('currency')}
        </Field>
        {missing.length > 0 && (
          <p className="warning" data-setup="glyphs">
            The stage draws prizes in 3D with a typeface that has no {missing.join(' or ')}, so
            the crates will show ? in its place. The tab and the host's lines show it as typed.
          </p>
        )}
        <Field label="Step" hint="Every prize is a multiple of this.">
          {number('step')}
        </Field>
        <Field
          label="Target"
          hint={
            montyHall
              ? 'What a player who always switches wins on average.'
              : 'What a player wins on average.'
          }
        >
          {number('target')}
        </Field>
        {withinRange && (
          <>
            <Field label="Min" hint="The least a show ends on, with the bonus.">
              {number('min')}
            </Field>
            <Field label="Max" hint="The most a show can pay.">
              {number('max')}
            </Field>
          </>
        )}
      </section>

      <details className="lines">
        <summary>The host's lines</summary>
        <p className="hint">
          One variant per line, said in turn; leave a box blank to keep the host's own words. These
          fill in as the show goes: {placeholders.map((name) => `{${name}}`).join(' ')}
        </p>
        {lineKeys.map((key) => (
          <Field key={key} label={lineLabels[key]}>
            <textarea
              name={key}
              data-setup={`line-${key}`}
              // Room for each default variant, which the placeholder shows, at about two lines each
              rows={2 * giftLines[key].length}
              value={draft.lines[key] ?? ''}
              placeholder={giftLines[key].join('\n')}
              onChange={(event) => update({ lines: { ...draft.lines, [key]: event.target.value } })}
            />
          </Field>
        ))}
      </details>

      {config && <Preview config={config} />}

      <section className="share">
        <h2>The link</h2>
        {validation.ok && payload ? (
          <LinkPanel payload={payload} config={validation.config} />
        ) : (
          <>
            <p>Fix these to get the link:</p>
            <ul className="errors" data-setup="errors">
              {(validation.ok ? [] : validation.errors).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </>
        )}
      </section>
      <p>
        <a href="#">Back to the demo show</a>
      </p>
    </main>
  )
}
