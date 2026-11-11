import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoDefaults, encodedLength, giftDefaults, limits, validateConfig } from './config.ts'

// A valid gift, with one field replaced
function gift(field: string, value: unknown): Record<string, unknown> {
  return { ...giftDefaults(), name: 'Alex', [field]: value }
}

function errorsOf(input: unknown, kind: 'demo' | 'gift' = 'gift'): string[] {
  const result = validateConfig(input, kind)
  return result.ok ? [] : result.errors
}

void test('both defaults validate', () => {
  const demo = validateConfig(demoDefaults(), 'demo')
  assert.ok(demo.ok)
  assert.deepEqual(demo.config, demoDefaults())
  assert.equal(demo.config.game, 'montyHall')
  assert.equal(demo.config.prizes, 'pureOdds')

  const named = { ...giftDefaults(), name: 'Alex' }
  const result = validateConfig(named, 'gift')
  assert.ok(result.ok)
  assert.deepEqual(result.config, named)
  assert.equal(result.config.prizes, 'withinRange')
  assert.deepEqual(
    [result.config.rounds, result.config.target, result.config.min, result.config.max],
    [5, 100, 60, 140],
  )
  // A new gift has no name until the giver writes one, and that's the one thing it lacks
  assert.deepEqual(errorsOf(giftDefaults()), ['Name is needed.'])
})

void test('text is trimmed, and lengths count what a person sees', () => {
  const result = validateConfig(
    {
      ...gift('name', '  Zoë  '),
      from: ' Sam ',
      currency: ' € ',
      lines: { won: ['  Yes!  ', '   '], offer: ['  '] },
    },
    'gift',
  )
  assert.ok(result.ok)
  assert.equal(result.config.name, 'Zoë')
  assert.equal(result.config.from, 'Sam')
  assert.equal(result.config.currency, '€')
  // A blank variant is dropped, and a key left with none keeps its default
  assert.deepEqual(result.config.lines, { won: ['Yes!'] })
  // A family emoji is one character to a reader, though several code points
  assert.ok(validateConfig(gift('name', '👨‍👩‍👧'.repeat(limits.name)), 'gift').ok)
})

void test('each rule, broken alone, is rejected with its message', () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ['name missing', gift('name', '   '), 'Name is needed.'],
    ['name too long', gift('name', 'a'.repeat(41)), 'Name must be at most 40 characters.'],
    ['name not text', gift('name', 7), 'Name must be text.'],
    ['from too long', gift('from', 'a'.repeat(41)), 'From must be at most 40 characters.'],
    ['occasion missing', gift('occasion', ''), 'Occasion is needed.'],
    [
      'occasion too long',
      gift('occasion', 'a'.repeat(31)),
      'Occasion must be at most 30 characters.',
    ],
    ['game mode', gift('game', 'classic'), 'Game mode must be Monty Hall or simple.'],
    ['prize mode', gift('prizes', 'random'), 'Prize mode must be pure odds or within range.'],
    ['rounds zero', gift('rounds', 0), 'Rounds must be a whole number from 1 to 10.'],
    ['rounds eleven', gift('rounds', 11), 'Rounds must be a whole number from 1 to 10.'],
    ['rounds fractional', gift('rounds', 2.5), 'Rounds must be a whole number from 1 to 10.'],
    ['step zero', gift('step', 0), 'Step must be a whole number of at least 1.'],
    ['step fractional', gift('step', 2.5), 'Step must be a whole number of at least 1.'],
    ['target off the step', gift('target', 102), 'Target must be a multiple of the step.'],
    ['target below the step', gift('target', 0), 'Target must be a whole number of at least 5.'],
    ['min off the step', gift('min', 61), 'Min must be a multiple of the step.'],
    ['max off the step', gift('max', 141), 'Max must be a multiple of the step.'],
    ['min above the target', gift('min', 105), "Min can't be above the target."],
    ['max below the target', gift('max', 95), "Max can't be below the target."],
    [
      'max below rounds times step',
      { ...gift('step', 10), rounds: 10, target: 60, min: 0, max: 90 },
      'Max must be at least the rounds times the step, 100.',
    ],
    ['currency empty', gift('currency', ' '), 'Currency must be 1 to 3 characters.'],
    ['currency too long', gift('currency', 'EURO'), 'Currency must be 1 to 3 characters.'],
    ['unknown line', gift('lines', { goodbye: ['Bye!'] }), 'There\'s no host line called "goodbye".'],
    [
      'line not a list',
      gift('lines', { won: 'You won!' }),
      'The host\'s line "won" must be a list of text.',
    ],
    [
      'unknown placeholder',
      gift('lines', { won: ['You won {prise}!'] }),
      'The host\'s line "won" uses {prise}, which isn\'t a placeholder.',
    ],
    [
      'unknown placeholder in two variants',
      gift('lines', { won: ['You won {prise}!', 'The {prise} is yours!'] }),
      'The host\'s line "won" uses {prise}, which isn\'t a placeholder.',
    ],
    [
      'link too long',
      gift('lines', { won: ['You won {prize}! '.repeat(200)] }),
      "The link would be longer than 4,000 characters; shorten the host's lines.",
    ],
  ]
  for (const [rule, input, message] of cases) {
    assert.deepEqual(errorsOf(input), [message], rule)
  }
  assert.deepEqual(errorsOf(null), ['The settings are missing.'])
  assert.deepEqual(errorsOf([]), ['The settings are missing.'])
})

void test('the min and max are checked only where they play', () => {
  // Pure odds ignores them, so they needn't fit the target or the step
  const pure = { ...gift('prizes', 'pureOdds'), min: 0, max: 7 }
  assert.ok(validateConfig(pure, 'gift').ok)
  assert.deepEqual(errorsOf({ ...pure, min: -5 }), [
    'Min and max must be whole numbers of at least 0.',
  ])
  // The demo needs no name
  assert.ok(validateConfig({ ...demoDefaults(), prizes: 'withinRange' }, 'demo').ok)
})

void test('the link length counts the base64url text of the payload', () => {
  const config = { ...giftDefaults(), name: 'Alex' }
  const json = JSON.stringify({ v: 1, ...config })
  assert.equal(encodedLength(config), Buffer.from(json).toString('base64url').length)
  const accented = { ...config, name: 'Zoë 🎉' }
  assert.equal(
    encodedLength(accented),
    Buffer.from(JSON.stringify({ v: 1, ...accented })).toString('base64url').length,
  )
})
