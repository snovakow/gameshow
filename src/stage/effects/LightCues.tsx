import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Color } from 'three'
import { time } from 'three/tsl'
import {
  envelope,
  lightCues,
  strobeLit,
  type BulbMode,
  type Envelope,
  type LightChange,
} from '../../game/lightCues.ts'
import { lightRig } from '../studio/lightRig.ts'
import { marqueeMode, marqueeModes } from '../studio/marqueeMode.ts'
import { restingRings, ringColours } from '../studio/rings.ts'
import { useCelebrationCues } from './useCelebrationCues.ts'

// A change under way: when it began, how it comes and goes, how far it reaches at full, and from
// where it rose, so a change that takes over from another starts where that one stood
interface Running {
  start: number
  shape: Envelope
  amount: number
  from: number
}

// A strobing spot's brightness in the strobe's lit and dark halves, as a multiple of its own
const strobeHigh = 1.6
const strobeLow = 0.25
// The coloured spots' pools swing this far either side of where they rest, in the stage's units,
// once every this many seconds, brighter by this much at the height of the sweep
const sweepReach = 2.2
const sweepPeriod = 2.4
const sweepBrighter = 0.6

const stopped = (): Running => ({
  start: 0,
  shape: { rise: 0, hold: 0, fall: 0 },
  amount: 0,
  from: 0,
})

const seconds = () => performance.now() / 1000

// How far a change reaches at a time: from where it rose toward its amount, then its amount, then
// falling away to nothing
function level(running: Running, now: number) {
  const elapsed = now - running.start
  const shown = envelope(elapsed, running.shape)
  if (elapsed < running.shape.rise) return running.from + (running.amount - running.from) * shown
  return running.amount * shown
}

// A change set going now, rising from wherever it stands
function begin(running: Running, now: number, shape: Envelope, amount: number) {
  running.from = level(running, now)
  running.start = now
  running.shape = shape
  running.amount = amount
}

// A change let go now: it falls from wherever it stands, at its own pace
function release(running: Running, now: number) {
  const standing = level(running, now)
  running.amount = standing
  running.from = standing
  running.start = now
  running.shape = { rise: 0, hold: 0, fall: running.shape.fall }
}

function stop(running: Running) {
  Object.assign(running, stopped())
}

// Puts every light back as the studio made it
function rest() {
  const { fill, key, crateSpots, colourSpots } = lightRig
  for (const rig of [fill, key, ...crateSpots, ...colourSpots]) {
    if (rig) rig.light.intensity = rig.rest
  }
  for (const { light, aim } of colourSpots) light.target.position.copy(aim)
  ringColours.inner.value.copy(restingRings.inner)
  ringColours.outer.value.copy(restingRings.outer)
  marqueeMode.value = marqueeModes.chase
}

// The rings' colours at the height of a win and a loss
const goldRings = { inner: new Color(0xffd66b), outer: new Color(0xff8a00) }
const blueRings = { inner: new Color(0x2f6bff), outer: new Color(0x061a6e) }

// Every change the cues can have under way, and how the bulbs run until when
interface Runs {
  spots: Running[]
  sweep: Running
  strobe: Running
  dim: Running
  gold: Running
  blue: Running
  bulbs: { mode: BulbMode; until: number }
}

// The studio's lights answering the show, each cue once, as the show's light map has it: a spot on
// the player's crate, the bulbs racing through the drumroll, a strobe and gold rings for a win, a
// darkness and blue rings for a loss, and the coloured spots sweeping the stage as the show opens
// and at its finale. Each change rises, holds and falls on time, frame by frame, and switching
// the cues off puts every light back as it was
export function LightCues() {
  const runs = useRef<Runs>({
    spots: [stopped(), stopped(), stopped()],
    sweep: stopped(),
    strobe: stopped(),
    dim: stopped(),
    gold: stopped(),
    blue: stopped(),
    bulbs: { mode: 'chase', until: Infinity },
  })

  useCelebrationCues({
    onCue: (name, final) => {
      const now = seconds()
      const { spots, sweep, strobe, dim, gold, blue, bulbs } = runs.current
      const apply = (change: LightChange) => {
        switch (change.light) {
          case 'chosenSpot':
            if (final === null) return
            spots.forEach((spot, crate) => {
              if (crate === final) begin(spot, now, change.shape, change.level - 1)
              else release(spot, now)
            })
            return
          case 'sweep':
            begin(sweep, now, change.shape, 1)
            return
          case 'strobe':
            begin(strobe, now, change.shape, 1)
            return
          case 'dim':
            begin(dim, now, change.shape, 1 - change.level)
            return
          case 'rings':
            begin(change.colour === 'gold' ? gold : blue, now, change.shape, 1)
            release(change.colour === 'gold' ? blue : gold, now)
            return
          case 'bulbs':
            bulbs.mode = change.mode
            bulbs.until = now + change.seconds
            return
          case 'rest':
            for (const running of [...spots, sweep, strobe, dim, gold, blue]) release(running, now)
            bulbs.mode = 'chase'
            bulbs.until = Infinity
        }
      }
      lightCues[name].forEach(apply)
    },
    // Back at the title card, whatever was showing goes at once
    onReset: () => {
      const { spots, sweep, strobe, dim, gold, blue, bulbs } = runs.current
      for (const running of [...spots, sweep, strobe, dim, gold, blue]) stop(running)
      bulbs.mode = 'chase'
      bulbs.until = Infinity
    },
  })

  useEffect(() => rest, [])

  useFrame(() => {
    const now = seconds()
    const { spots, sweep, strobe, dim, gold, blue, bulbs } = runs.current
    const { fill, key, crateSpots, colourSpots } = lightRig
    const lit = 1 - level(dim, now)
    // In step with the bulbs, which strobe by the time the renderer last drew with
    const flashing = level(strobe, now)
    const flash = 1 + flashing * ((strobeLit(time.value) ? strobeHigh : strobeLow) - 1)
    const sweeping = level(sweep, now)
    // Timed by the clock rather than from the sweep's start, which letting it go moves, so a sweep
    // let go narrows from where it stands instead of jumping back to rest
    const turn = (2 * Math.PI * now) / sweepPeriod
    const swing = sweepReach * sweeping * Math.sin(turn)

    if (fill) fill.light.intensity = fill.rest * lit
    if (key) key.light.intensity = key.rest * lit
    for (let crate = 0; crate < crateSpots.length; crate++) {
      const { light, rest: resting } = crateSpots[crate]
      const spot = spots[crate]
      const raised = spot ? 1 + level(spot, now) : 1
      light.intensity = resting * raised * flash * lit
    }
    for (let index = 0; index < colourSpots.length; index++) {
      const { light, rest: resting, aim } = colourSpots[index]
      light.intensity = resting * (1 + sweepBrighter * sweeping) * flash * lit
      // The two cross the stage in opposite directions
      light.target.position.set(aim.x + (index % 2 ? -swing : swing), aim.y, aim.z)
    }

    const golden = level(gold, now)
    const blued = level(blue, now)
    const { inner, outer } = ringColours
    inner.value.copy(restingRings.inner).lerp(goldRings.inner, golden).lerp(blueRings.inner, blued)
    outer.value.copy(restingRings.outer).lerp(goldRings.outer, golden).lerp(blueRings.outer, blued)

    if (now >= bulbs.until) {
      bulbs.mode = 'chase'
      bulbs.until = Infinity
    }
    marqueeMode.value = marqueeModes[bulbs.mode]
  })

  return null
}
