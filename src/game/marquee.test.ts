import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoTitle, marqueeTitle, missingCharacters } from './marquee.ts'

void test('the demo spells the show, and a gift greets its recipient in capitals', () => {
  assert.equal(marqueeTitle(null), demoTitle)
  assert.equal(marqueeTitle({ occasion: 'birthday', name: 'Alex' }), 'HAPPY BIRTHDAY, ALEX!')
  assert.equal(marqueeTitle({ occasion: ' anniversary ', name: ' Sam ' }), 'HAPPY ANNIVERSARY, SAM!')
})

void test('a missing character is named as the title draws it, upper-cased', () => {
  // A typeface with lower-case ë but not Ë, as the stage's has
  const glyphs = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz,!ë')
  assert.deepEqual(missingCharacters(marqueeTitle({ occasion: 'birthday', name: 'Zoë' }), glyphs), [
    'Ë',
  ])
  assert.deepEqual(
    missingCharacters(marqueeTitle({ occasion: 'birthday', name: 'Łukasz' }), glyphs),
    ['Ł'],
  )
  assert.deepEqual(missingCharacters(marqueeTitle({ occasion: 'birthday', name: 'Alex' }), glyphs), [])
})

void test('each missing character is named once, in order', () => {
  assert.deepEqual(missingCharacters('€a€¢', new Set(['a'])), ['€', '¢'])
})
