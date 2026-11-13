import { Vector3 } from 'three'

// Where the stage's parts stand, in one place, so the stage is rearranged here and everything that
// frames, lights or aims at it follows

// Where the crates stand, on x and z, in a row across the front of the stage; numbered 1, 2 and 3
// in this order, which reads left to right from the opening view
export const crates: [number, number][] = [
  [-1.5, 0],
  [0, 0],
  [1.5, 0],
]

// The round podium the host stands on behind the row. Low, so she stands not far above the
// crates, but high enough to lift her feet just clear of the middle crate's top from the opening
// view as she stands; a dance's step toward its front can take them behind it a moment. Its radius
// holds her feet through every clip with 0.05 to spare: her dances wander, the widest taking a
// shoe 1.275 from her spot. Its front edge stands 0.27 behind the middle crate's ring, which sets
// how far back she stands. The sides are the polygon its round edge is drawn and framed with
const podiumRadius = 1.33
export const podium = { radius: podiumRadius, height: 0.25, sides: 64 }
const podiumFront = -0.95

// Where the host stands: on the podium behind the row, or on the floor, nearer the row and framed
// closer so she draws larger. The panel's Host select picks one, and everything placed by her
// follows it
export type HostMode = 'podium' | 'floor'

// Where the stage's parts stand for one place of the host's
export interface Places {
  // Whether the podium stands, and she on it
  onPodium: boolean
  // Her spot, under her feet
  hostSpot: Vector3
  // Her idling pose's box, which the framing fits
  hostBox: { min: Vector3; max: Vector3 }
  // The speech bubble's anchor, above her spot rather than her head, which moves while she dances
  bubbleAnchor: Vector3
  // The opening view's camera and the point it looks at, which the show goes home to
  opening: Vector3
  lookAt: Vector3
  // The nearest the framing brings the camera
  nearest: number
  // The title in lights: its middle, and its size against its full one
  marquee: { place: Vector3; scale: number }
  // Where the fireworks burst: the box's lowest height and nearest depth, and how deep it runs
  // back from there
  fireworks: { low: number; near: number; depth: number }
  // How much farther back than the framed view the camera stands while a win is celebrated, so the
  // confetti and the flames at the stage's sides have room
  pullBack: number
  // The point the finale's wide view looks at
  finaleTarget: Vector3
}

// Her idling pose's box, measured from her model on her spot, whose hair reaches 1.67 above it; and
// the bubble's anchor above her spot, her head's top being about 1.59 above her feet
function standing(spot: Vector3) {
  return {
    hostSpot: spot,
    hostBox: {
      min: new Vector3(-0.3, 0, -0.18).add(spot),
      max: new Vector3(0.26, 1.67, 0.27).add(spot),
    },
    bubbleAnchor: new Vector3(0, 1.9, 0).add(spot),
  }
}

const onPodium = standing(new Vector3(0, podium.height, podiumFront - podiumRadius))
// The opening view: the line of sight and distance the stage has always had, from (1, 2, 4) at
// (0, 0.5, 0), raised and moved back with the stage, so it takes in the row and the host behind it
const podiumLookAt = new Vector3(0, 0.9, -0.75)
const podiumOpening = new Vector3(1, 2.4, 3.25)

// On the floor she stands nearer the row, her box's front a quarter of a unit behind the middle
// crate's ring, which hides her legs to about the knee
const onFloor = standing(new Vector3(0, 0, -1.2))
// The same line of sight, lowered for her height and brought toward the row
const floorLookAt = new Vector3(0, 0.7, -0.5)
const floorOpening = new Vector3(1, 2.2, 3.5)

export const places: Record<HostMode, Places> = {
  podium: {
    onPodium: true,
    ...onPodium,
    opening: podiumOpening,
    lookAt: podiumLookAt,
    // Never nearer than the opening view, so a screen as wide as a desktop's keeps exactly that
    // view
    nearest: podiumOpening.distanceTo(podiumLookAt),
    // Above and behind her podium, high enough to clear her head from the opening view on every
    // screen and low enough to stay clear of the panel's bar at the top of a wide screen
    marquee: { place: new Vector3(0, 2.67, -4.38), scale: 0.85 },
    // Behind her and in front of the title, at its height, since the opening view sees little sky
    // above it
    fireworks: { low: 2.4, near: -2.7, depth: 1.4 },
    pullBack: 1.3,
    // Between the row and her podium, where the wide view takes in the row, her, the title and the
    // fireworks over it
    finaleTarget: new Vector3(0, 1.2, -1.2),
  },
  floor: {
    onPodium: false,
    ...onFloor,
    opening: floorOpening,
    lookAt: floorLookAt,
    // As near as the controls allow, so the fit alone sets the distance and a wide screen comes in
    // until the stage meets the view's margin
    nearest: 1,
    // Lower and nearer than over the podium, and smaller, to stay clear of her head and of the
    // panel's bar from the closer view: at 0.8 of its size it met the bar on a phone held sideways
    marquee: { place: new Vector3(0, 2.0, -4.0), scale: 0.7 },
    // Behind her at the title's height
    fireworks: { low: 1.9, near: -1.8, depth: 1.8 },
    // Farther back in proportion than from the podium's farther view, which keeps both flames
    // whole on every screen
    pullBack: 1.45,
    finaleTarget: new Vector3(0, 1, -0.9),
  },
}
