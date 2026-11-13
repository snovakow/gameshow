import { useLoader, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Color, Group, InstancedMesh, Matrix4, Mesh, SphereGeometry } from 'three'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import {
  color,
  float,
  floor,
  fract,
  instanceIndex,
  mix,
  pow,
  select,
  step,
  time,
} from 'three/tsl'
import { MeshLambertNodeMaterial } from 'three/webgpu'
import { strobeRate } from '../../game/lightCues.ts'
import { marqueeTitle } from '../../game/marquee.ts'
import { useGame } from '../../store.ts'
import { fontUrl, useMetals } from '../materials.ts'
import { marqueeMode, marqueeModes } from './marqueeMode.ts'

// Above and behind the host's podium, high enough to clear her head from the opening view on every
// screen and low enough to stay clear of the panel's bar at the top of a wide screen, tipped a
// little toward the camera, and drawn at this much of its full size, bulbs and all, to fit there
const place = [0, 2.67, -4.38] as const
const tilt = -0.12
const signScale = 0.85
// The lettering, before it scales down to fit
const letterSize = 0.34
const letterDepth = 0.05
// A long greeting scales down until it is no wider than this
const maxWidth = 3.4
// The bulbs stand this far out from the lettering, this far apart, and this big
const margin = 0.16
const spacing = 0.13
const bulbRadius = 0.035

// The bulbs' warm white, and how much of it a bulb that's off still gives
const bulbColour = new Color(0xffd27a)
const unlit = 0.12
// The chase lights every third bulb and steps this many times a second
const chaseEvery = 3
const chaseSteps = 6
// The race sends a light round the whole sign this many times a second, its tail this sharp
const raceLaps = 0.8
const raceTail = 6

// Each bulb's place round a rectangle of this width and height, centred on the origin, evenly
// spaced and in order clockwise from the top left corner, so a pattern run by index runs round it
function bulbPlaces(width: number, height: number): [number, number][] {
  const perimeter = 2 * (width + height)
  const count = Math.round(perimeter / spacing)
  const places: [number, number][] = []
  for (let i = 0; i < count; i++) {
    let along = (i / count) * perimeter
    if (along < width) {
      places.push([-width / 2 + along, height / 2])
      continue
    }
    along -= width
    if (along < height) {
      places.push([width / 2, height / 2 - along])
      continue
    }
    along -= height
    if (along < width) {
      places.push([width / 2 - along, -height / 2])
      continue
    }
    along -= width
    places.push([-width / 2, -height / 2 + along])
  }
  return places
}

// How bright each bulb is, from its place in the ring and the time alone, so every frame's work is
// the GPU's and the whole ring is one draw
function bulbBrightness(count: number) {
  const index = float(instanceIndex)
  // Each bulb's count is taken half a step on, so none falls exactly on the cutoff, where how the
  // GPU rounds a division would decide whether it lights. The steps are taken off the count, so the
  // chase runs clockwise, the way the race runs
  const chase = select(
    fract(index.sub(floor(time.mul(chaseSteps))).add(0.5).div(chaseEvery)).lessThan(1 / chaseEvery),
    float(1),
    float(unlit),
  )
  // Brightest at the head, fading behind it, dark ahead of it
  const race = mix(float(unlit), float(1), pow(fract(index.div(count).sub(time.mul(raceLaps))), raceTail))
  // Every bulb flashing together, as slowly as the show's strobe flashes the spots
  const strobe = mix(float(unlit), float(1), step(0.5, fract(time.mul(strobeRate))))
  return select(
    marqueeMode.equal(marqueeModes.chase),
    chase,
    select(
      marqueeMode.equal(marqueeModes.race),
      race,
      select(marqueeMode.equal(marqueeModes.strobe), strobe, float(unlit)),
    ),
  )
}

// The show's title in gold letters over the stage, ringed by chasing bulbs: GAMESHOW in the demo,
// the greeting on a gift. The bulbs shine, so the bloom lights them
export function Marquee() {
  const get = useThree((s) => s.get)
  const font = useLoader(FontLoader, fontUrl)
  const gift = useGame((s) => s.gift)
  const title = marqueeTitle(gift ? gift.config : null)
  const gold = useMetals((s) => s.gold)
  const lettering = useRef<Mesh | null>(null)

  useLayoutEffect(() => {
    const { scene } = get()
    const sign = new Group()
    sign.position.set(...place)
    sign.rotation.x = tilt
    sign.scale.setScalar(signScale)

    const letters = new TextGeometry(title, {
      font,
      size: letterSize,
      depth: letterDepth,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.008,
      bevelSegments: 2,
    })
    letters.computeBoundingBox()
    // Typed as nullable, but computeBoundingBox() has just set it
    const { min, max } = letters.boundingBox!
    letters.translate(-(min.x + max.x) / 2, -(min.y + max.y) / 2, -letterDepth / 2)
    const scale = Math.min(1, maxWidth / (max.x - min.x))
    const lettered = new Mesh(letters, useMetals.getState().gold)
    lettered.scale.setScalar(scale)
    lettering.current = lettered

    const places = bulbPlaces(
      (max.x - min.x) * scale + 2 * margin,
      (max.y - min.y) * scale + 2 * margin,
    )
    const bulb = new SphereGeometry(bulbRadius, 10, 6)
    // Black and unlit but for what it gives off, which reaches the bloom as well as the frame
    const glass = new MeshLambertNodeMaterial({ color: 0x000000 })
    glass.lights = false
    glass.emissiveNode = color(bulbColour).mul(bulbBrightness(places.length))
    const bulbs = new InstancedMesh(bulb, glass, places.length)
    const matrix = new Matrix4()
    places.forEach(([x, y], i) => bulbs.setMatrixAt(i, matrix.makeTranslation(x, y, 0)))
    bulbs.instanceMatrix.needsUpdate = true

    // The sign is decoration: it takes no presses and casts no shadow
    for (const part of [lettered, bulbs]) part.raycast = () => undefined
    sign.add(lettered, bulbs)
    scene.add(sign)
    return () => {
      lettering.current = null
      scene.remove(sign)
      letters.dispose()
      bulb.dispose()
      glass.dispose()
      bulbs.dispose()
    }
  }, [get, font, title])

  // The letters take whichever gold the stage draws with now. Declared after the sign's own effect,
  // so it runs after it in the same commit
  useLayoutEffect(() => {
    if (lettering.current) lettering.current.material = gold
  }, [gold])

  return null
}
