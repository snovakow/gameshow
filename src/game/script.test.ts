import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createScript,
  demoLines,
  formatAmount,
  giftLines,
  lineKeys,
  placeholders,
  unknownPlaceholders,
  type ScriptSettings,
} from './script.ts'

function settings(overrides: Partial<ScriptSettings>): ScriptSettings {
  return { name: 'Alex', from: 'Sam', occasion: 'birthday', currency: '$', lines: {}, ...overrides }
}

void test('every key has a default in both sets, using only known placeholders', () => {
  for (const lines of [giftLines, demoLines]) {
    assert.deepEqual(Object.keys(lines).toSorted(), [...lineKeys].toSorted())
    for (const key of lineKeys) {
      assert.ok(lines[key].length > 0, key)
      for (const variant of lines[key]) assert.deepEqual(unknownPlaceholders(variant), [], key)
    }
  }
  // The demo has no recipient, so none of its lines name one
  for (const key of lineKeys) {
    for (const variant of demoLines[key]) assert.ok(!variant.includes('{name}'), key)
  }
})

void test('each default list that names the giver also has a variant that doesn\'t', () => {
  for (const lines of [giftLines, demoLines]) {
    for (const key of lineKeys) {
      if (lines[key].some((variant) => variant.includes('{from}'))) {
        assert.ok(
          lines[key].some((variant) => !variant.includes('{from}')),
          key,
        )
      }
    }
  }
})

void test('the gift and demo defaults read as written', () => {
  const gift = createScript(settings({}), 'gift')
  assert.equal(gift('title'), 'Happy birthday, Alex! Your show is ready.')
  assert.equal(gift('welcome'), 'Happy birthday, Alex! Welcome to your very own game show!')
  assert.equal(gift('round', { round: 2, rounds: 5, prize: 20 }), 'Round 2 of 5, for $20!')
  assert.equal(
    gift('offer', { pick: 1, other: 3 }),
    'Empty! Stay with crate 1, or switch to crate 3?',
  )
  assert.equal(gift('bonus', { bonus: 60 }), "Because it's your birthday, here's a bonus of $60!")
  assert.equal(
    gift('finale', { total: 1000 }),
    "Alex, you're going home with $1,000! Happy birthday, from Sam!",
  )

  const demo = createScript(settings({ name: '', from: '' }), 'demo')
  assert.equal(demo('title'), '')
  assert.equal(demo('welcome'), 'Welcome to your very own game show!')
  assert.equal(demo('finale', { total: 115 }), "You're going home with $115!")
})

void test('every placeholder fills', () => {
  const template = placeholders.map((name) => `${name}={${name}}`).join(' ')
  const script = createScript(settings({ currency: '£', lines: { total: [template] } }), 'gift')
  assert.equal(
    script('total', {
      round: 3,
      rounds: 5,
      prize: 25,
      total: 1500,
      bonus: 60,
      pick: 1,
      opened: 2,
      other: 3,
      final: 3,
      winner: 1,
    }),
    'name=Alex from=Sam occasion=birthday round=3 rounds=5 prize=£25 total=£1,500 bonus=£60 ' +
      'pick=1 opened=2 other=3 final=3 winner=1',
  )
})

void test('a variant with an empty value is skipped for one without it', () => {
  const script = createScript(settings({ from: '' }), 'gift')
  assert.equal(script('finale', { total: 100 }), "Alex, you're going home with $100! Happy birthday!")
  // A value the line isn't given is empty too
  const own = createScript(
    settings({ lines: { won: ['{prize}, for a tab of {total}!', 'Well done!'] } }),
    'gift',
  )
  assert.equal(own('won', { prize: 10 }), 'Well done!')
  assert.equal(own('won', { prize: 10 }), 'Well done!')
  assert.equal(own('won', { prize: 10, total: 30 }), '$10, for a tab of $30!')
  // When none of the giver's variants can be said, the default is
  const unsayable = createScript(settings({ from: '', lines: { won: ['Love, {from}'] } }), 'gift')
  assert.equal(unsayable('won', { prize: 10 }), 'You won $10!')
})

void test('variants rotate per key', () => {
  const script = createScript(
    settings({ lines: { pick: ['A', 'B', 'C'], won: ['One {prize}', 'Two {prize}'] } }),
    'gift',
  )
  assert.deepEqual(
    Array.from({ length: 4 }, () => script('pick')),
    ['A', 'B', 'C', 'A'],
  )
  assert.equal(script('won', { prize: 5 }), 'One $5')
  assert.equal(script('pick'), 'B')
  assert.equal(script('won', { prize: 5 }), 'Two $5')
  assert.equal(script('won', { prize: 5 }), 'One $5')
})

void test('an unknown placeholder is reported', () => {
  assert.deepEqual(unknownPlaceholders('You won {prise}, {Name} {prise} { name }!'), [
    'prise',
    'Name',
    ' name ',
  ])
  assert.deepEqual(unknownPlaceholders('No braces, or one { alone'), [])
  assert.deepEqual(unknownPlaceholders('{prize} {total} {bonus}'), [])
})

void test('amounts format with the currency first and comma thousands', () => {
  assert.equal(formatAmount(1000, '$'), '$1,000')
  assert.equal(formatAmount(0, '$'), '$0')
  assert.equal(formatAmount(999, '$'), '$999')
  assert.equal(formatAmount(1234567, '£'), '£1,234,567')
  assert.equal(formatAmount(60, 'CHF'), 'CHF60')
})
