import { Vector3 } from 'three'

// Where the stage's parts stand, in one place, so the stage is rearranged here and everything that
// frames, lights or aims at it follows

// Where the crates stand, on x and z; numbered 1, 2 and 3 in this order, which reads left to right
// from the opening view
export const crates: [number, number][] = [
  [-1.5, 0],
  [0, -1.5],
  [1.5, 0],
]

// Where the host stands: the floor under her feet
export const hostSpot = new Vector3(0, 0, 1)
// Her idling pose's box, measured from her model on her spot, whose hair reaches 1.67 above it.
// The framing fits it, and the host takes presses in it in her place
export const hostBox = {
  min: new Vector3(-0.3, 0, -0.18).add(hostSpot),
  max: new Vector3(0.26, 1.67, 0.27).add(hostSpot),
}
// The speech bubble's anchor, above her spot rather than her head, which moves while she dances;
// her head's top is at about 1.59 above her feet
export const bubbleAnchor = new Vector3(0, 1.9, 0).add(hostSpot)

// The opening view the stage has always had: from (1, 2, 4), looking at a point half a unit above
// the middle of the floor
export const opening = new Vector3(1, 2, 4)
export const lookAt = new Vector3(0, 0.5, 0)
