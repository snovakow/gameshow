import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mulberry32 } from './random.ts'
import {
  choiceForCrate,
  crateCount,
  finalCrate,
  hostOpens,
  otherCrate,
  randomCrate,
} from './rules.ts'

const crates = [0, 1, 2]

void test('a seed replays the same draws, all in [0, 1)', () => {
  const a = mulberry32(42)
  const b = mulberry32(42)
  const other = mulberry32(43)
  const draws = Array.from({ length: 1000 }, () => a())
  assert.deepEqual(
    Array.from({ length: 1000 }, () => b()),
    draws,
  )
  assert.notDeepEqual(
    Array.from({ length: 1000 }, () => other()),
    draws,
  )
  assert.ok(draws.every((x) => x >= 0 && x < 1))
})

void test('the prize is placed uniformly', () => {
  const random = mulberry32(1)
  const draws = 30000
  const counts = [0, 0, 0]
  for (let i = 0; i < draws; i++) counts[randomCrate(random)]++
  for (const count of counts) assert.ok(Math.abs(count / draws - 1 / crateCount) < 0.02, `${count}`)
})

void test('the host never opens the pick or the prize', () => {
  const random = mulberry32(2)
  for (const pick of crates) {
    for (const prize of crates) {
      for (let i = 0; i < 1000; i++) {
        const opened = hostOpens(pick, prize, random)
        assert.ok(crates.includes(opened))
        assert.notEqual(opened, pick)
        assert.notEqual(opened, prize)
      }
    }
  }
})

void test('with the prize in the pick, the host chooses between the other two at random', () => {
  const draws = 10000
  for (const pick of crates) {
    const random = mulberry32(3 + pick)
    const [first] = crates.filter((crate) => crate !== pick)
    let firstCount = 0
    for (let i = 0; i < draws; i++) if (hostOpens(pick, pick, random) === first) firstCount++
    assert.ok(Math.abs(firstCount / draws - 0.5) <= 0.03, `${firstCount} of ${draws}`)
  }
})

void test('switching wins two times in three, and staying one in three', () => {
  const random = mulberry32(4)
  const rounds = 30000
  const wins = { stay: 0, switch: 0 }
  for (let i = 0; i < rounds; i++) {
    const prize = randomCrate(random)
    const pick = randomCrate(random)
    const opened = hostOpens(pick, prize, random)
    if (finalCrate(pick, opened, 'stay') === prize) wins.stay++
    if (finalCrate(pick, opened, 'switch') === prize) wins.switch++
  }
  assert.ok(Math.abs(wins.switch / rounds - 2 / 3) <= 0.02, `switch ${wins.switch}`)
  assert.ok(Math.abs(wins.stay / rounds - 1 / 3) <= 0.02, `stay ${wins.stay}`)
})

void test('switching takes the one other closed crate, and a crate click maps to a choice', () => {
  for (const pick of crates) {
    for (const opened of crates.filter((crate) => crate !== pick)) {
      const other = otherCrate(pick, opened)
      assert.deepEqual([pick, opened, other].toSorted((a, b) => a - b), crates)
      assert.equal(finalCrate(pick, opened, 'stay'), pick)
      assert.equal(finalCrate(pick, opened, 'switch'), other)
      assert.equal(choiceForCrate(pick, pick, opened), 'stay')
      assert.equal(choiceForCrate(other, pick, opened), 'switch')
      assert.equal(choiceForCrate(opened, pick, opened), null)
    }
  }
})
