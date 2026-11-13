import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CueName } from './director.ts'
import { envelope, lightCues, strobeLit, strobeRate, type LightChange } from './lightCues.ts'

const lights = (cue: CueName) => lightCues[cue].map((change) => change.light)
type Of<L> = Extract<LightChange, { light: L }>
const find = <L extends LightChange['light']>(cue: CueName, light: L) =>
  lightCues[cue].find((change): change is Of<L> => change.light === light)

void test('each cue the show lights does what it promises', () => {
  assert.deepEqual(lights('pick'), ['chosenSpot'])
  assert.equal(find('drumroll', 'bulbs')?.mode, 'race')
  assert.ok(lights('reveal').includes('chosenSpot'))
  assert.deepEqual(lights('win').toSorted(), ['bulbs', 'strobe'])
  assert.equal(find('win', 'bulbs')?.mode, 'strobe')
  assert.deepEqual(lights('lose').toSorted(), ['bulbs', 'dim'])
  assert.equal(find('lose', 'bulbs')?.mode, 'dim')
  assert.deepEqual(lights('showStart'), ['sweep'])
  assert.deepEqual(lights('finale'), ['sweep'])
})

void test('a new round and moving on rest the lights, and the other cues leave them be', () => {
  assert.deepEqual(lights('roundStart'), ['rest'])
  assert.deepEqual(lights('next'), ['rest'])
  for (const cue of ['hostOpens', 'dud', 'stay', 'switch', 'bonus'] as const) {
    assert.deepEqual(lightCues[cue], [], cue)
  }
})

void test('the brief changes end on their own, and the bulbs stop strobing as the spots do', () => {
  const strobe = find('win', 'strobe')
  const bulbs = find('win', 'bulbs')
  assert.ok(strobe && bulbs)
  const { rise, hold, fall } = strobe.shape
  assert.equal(bulbs.seconds, rise + hold + fall)
  for (const cue of ['showStart', 'win', 'finale'] as const) {
    for (const change of lightCues[cue]) {
      if ('shape' in change) assert.ok(Number.isFinite(change.shape.hold), cue)
    }
  }
  const darkness = find('lose', 'dim')
  const dimBulbs = find('lose', 'bulbs')
  assert.ok(darkness && dimBulbs)
  assert.equal(dimBulbs.seconds, darkness.shape.rise + darkness.shape.hold + darkness.shape.fall)
})

void test('the strobe flashes fewer than three times a second, half of each flash lit', () => {
  assert.ok(strobeRate < 3)
  let flashes = 0
  let lit = 0
  let was = strobeLit(0)
  const steps = 10000
  for (let i = 1; i <= steps; i++) {
    const now = strobeLit(i / steps)
    if (now && !was) flashes++
    if (now) lit++
    was = now
  }
  assert.ok(flashes <= strobeRate, `${flashes} flashes`)
  assert.ok(Math.abs(lit / steps - 0.5) < 0.01)
})

void test('an envelope rises smoothly, holds, and falls smoothly back to nothing', () => {
  const shape = { rise: 1, hold: 2, fall: 1 }
  assert.equal(envelope(-0.1, shape), 0)
  assert.equal(envelope(0, shape), 0)
  assert.ok(Math.abs(envelope(0.5, shape) - 0.5) < 1e-12)
  assert.equal(envelope(1, shape), 1)
  assert.equal(envelope(2.9, shape), 1)
  assert.ok(Math.abs(envelope(3.5, shape) - 0.5) < 1e-12)
  assert.equal(envelope(4, shape), 0)
  assert.equal(envelope(100, shape), 0)
  // No step anywhere along it
  let last = 0
  for (let t = 0; t <= 4.2; t += 0.001) {
    const now = envelope(t, shape)
    assert.ok(Math.abs(now - last) < 0.01, `step at ${t}`)
    last = now
  }
})

void test('an endless envelope holds until the lights rest; one without a rise starts full', () => {
  assert.equal(envelope(1e6, { rise: 0.3, hold: Infinity, fall: 0.8 }), 1)
  assert.equal(envelope(0, { rise: 0, hold: 3, fall: 0 }), 1)
  assert.equal(envelope(3, { rise: 0, hold: 3, fall: 0 }), 0)
})
