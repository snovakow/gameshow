import assert from 'node:assert/strict'
import { test } from 'node:test'
import { giftDefaults, limits, linkPayload, type Config } from './config.ts'
import {
  decodeLink,
  encodeLink,
  fnv1a,
  giftHash,
  parseHash,
  progressKey,
  type LinkProblem,
} from './link.ts'

// A gift with every setting away from its default, names in UTF-8 and the host's own lines
function fullGift(): Config {
  return {
    name: 'Zoë Groß 🎉',
    from: 'Renée',
    occasion: 'graduation',
    game: 'simple',
    prizes: 'withinRange',
    rounds: 7,
    target: 210,
    min: 140,
    max: 280,
    step: 10,
    currency: '£',
    lines: {
      welcome: ['Bienvenue, {name}!', 'Hello again, {name}'],
      won: ['Straße frei: {prize}! 🎁'],
      finale: ['{name}: {total}, from {from}'],
    },
  }
}

// The payload as JSON, encoded the way a link is, for links the app itself would never make
function encodeJson(json: string): string {
  const bytes = new TextEncoder().encode(json)
  return encodeBytes(bytes)
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function problemOf(payload: string): LinkProblem | null {
  const decoded = decodeLink(payload)
  return decoded.ok ? null : decoded.problem
}

void test('every setting round-trips, names and lines in UTF-8 included', () => {
  const gift = fullGift()
  const payload = encodeLink(gift)
  assert.match(payload, /^[A-Za-z0-9_-]+$/)
  const decoded = decodeLink(payload)
  assert.ok(decoded.ok)
  assert.deepEqual(decoded.config, gift)
  // Each field on its own, so a field the link drops is caught whatever the others hold; the
  // amounts only make sense together, so they change as one
  const { target, min, max, step, ...rest } = gift
  const changes = [
    ...Object.entries(rest).map(([field, value]) => ({ [field]: value })),
    { target, min, max, step },
  ]
  for (const change of changes) {
    const single = { ...giftDefaults(), name: 'Alex', ...change }
    const back = decodeLink(encodeLink(single))
    assert.ok(back.ok, Object.keys(change).join())
    assert.deepEqual(back.config, single)
  }
  // Re-encoding a decoded link gives the same text, so the same gift keeps the same progress
  assert.equal(encodeLink(decoded.config), payload)
})

void test('the link carries the version and only the overridden lines', () => {
  const gift = { ...giftDefaults(), name: 'Alex', lines: { won: ['Yes!'] } }
  const binary = atob(encodeLink(gift).replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const json: unknown = JSON.parse(new TextDecoder().decode(bytes))
  assert.deepEqual(json, linkPayload(gift))
  assert.deepEqual(json, { v: 1, ...gift })
})

void test('a damaged link is rejected with its reason', () => {
  const payload = encodeLink(fullGift())
  // Not base64url at all, or a length base64 never has
  assert.equal(problemOf('abc$def'), 'encoding')
  assert.equal(problemOf('eyJ2Ij+xfQ'), 'encoding')
  assert.equal(problemOf(payload.slice(0, 4 * 10 + 1)), 'encoding')
  assert.equal(problemOf(''), 'encoding')
  // Bytes that aren't UTF-8, which a lenient decoder would turn into U+FFFD
  const notUtf8 = new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d])
  assert.equal(problemOf(encodeBytes(notUtf8)), 'encoding')
  // Valid base64url of something that isn't JSON: the link cut short, or its first character
  // changed, which encodes the opening brace
  assert.equal(problemOf(payload.slice(0, 40)), 'json')
  assert.equal(problemOf(`f${payload.slice(1)}`), 'json')
  assert.equal(problemOf(encodeJson('[1, 2]')), 'json')
  assert.equal(problemOf(encodeJson('"gift"')), 'json')
  // A newer version's link, or one that names none
  const unversioned: Record<string, unknown> = { ...linkPayload(fullGift()) }
  delete unversioned.v
  assert.equal(problemOf(encodeJson(JSON.stringify({ ...unversioned, v: 2 }))), 'version')
  assert.equal(problemOf(encodeJson(JSON.stringify(unversioned))), 'settings')
  assert.equal(problemOf(encodeJson(JSON.stringify({ ...unversioned, v: '1' }))), 'settings')
})

void test('a link whose settings fail validation gives the validation errors', () => {
  const nameless = encodeJson(JSON.stringify({ ...linkPayload(giftDefaults()), name: ' ' }))
  const decoded = decodeLink(nameless)
  assert.ok(!decoded.ok)
  assert.equal(decoded.problem, 'settings')
  assert.deepEqual(decoded.errors, ['Name is needed.'])

  const outOfRange = encodeJson(
    JSON.stringify({ ...linkPayload({ ...giftDefaults(), name: 'Alex' }), min: 150, rounds: 11 }),
  )
  const range = decodeLink(outOfRange)
  assert.ok(!range.ok)
  assert.deepEqual(range.errors, [
    'Rounds must be a whole number from 1 to 10.',
    "Min can't be above the target.",
  ])
})

void test('an oversized payload is rejected before it is decoded', () => {
  const long = 'A'.repeat(limits.link + 1)
  const decoded = decodeLink(long)
  assert.ok(!decoded.ok)
  assert.equal(decoded.problem, 'length')
  // A payload near the limit still decodes
  const lines = { welcome: ['x'.repeat(2700)] }
  const atLimit = encodeLink({ ...giftDefaults(), name: 'Alex', lines })
  assert.ok(atLimit.length <= limits.link)
  assert.ok(decodeLink(atLimit).ok)
})

void test('the fragment names the page', () => {
  assert.deepEqual(parseHash(''), { page: 'demo' })
  assert.deepEqual(parseHash('#'), { page: 'demo' })
  assert.deepEqual(parseHash('#elsewhere'), { page: 'demo' })
  assert.deepEqual(parseHash('#setup'), { page: 'setup' })
  assert.deepEqual(parseHash('#gift=abc'), { page: 'gift', payload: 'abc', trial: false })
  assert.deepEqual(parseHash('#gift=abc&try=1'), { page: 'gift', payload: 'abc', trial: true })
  assert.deepEqual(parseHash(giftHash('abc', true)), parseHash('#gift=abc&try=1'))
  assert.equal(giftHash('abc'), '#gift=abc')
})

void test('the progress key is stable for a payload and differs for another', () => {
  const payload = encodeLink(fullGift())
  const other = encodeLink({ ...fullGift(), rounds: 6 })
  assert.equal(progressKey(payload), progressKey(payload))
  assert.equal(progressKey(payload), progressKey(encodeLink(fullGift())))
  assert.notEqual(progressKey(payload), progressKey(other))
  assert.match(progressKey(payload), /^gameshow:progress:[0-9a-f]{8}$/)
  // FNV-1a's published 32-bit values
  assert.equal(fnv1a(''), '811c9dc5')
  assert.equal(fnv1a('a'), 'e40c292c')
  assert.equal(fnv1a('foobar'), 'bf9cf968')
})
