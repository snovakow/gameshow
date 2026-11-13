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

// The round podium the host stands on behind the row. Its height lifts her feet clear of the middle
// crate's top from the opening view. Its radius holds her feet through every clip with 0.05 to
// spare: her dances wander, the widest taking a shoe 1.275 from her spot. Its front edge stands
// 0.27 behind the middle crate's ring, which sets how far back she stands. The sides are the
// polygon its round edge is drawn and framed with
const podiumRadius = 1.33
export const podium = { radius: podiumRadius, height: 0.5, sides: 64 }
const podiumFront = -0.95

// Where the host stands: the podium's top under her feet, at its middle
export const hostSpot = new Vector3(0, podium.height, podiumFront - podiumRadius)
// Her idling pose's box, measured from her model on her spot, whose hair reaches 1.67 above it.
// The framing fits it, and the host takes presses in it in her place
export const hostBox = {
  min: new Vector3(-0.3, 0, -0.18).add(hostSpot),
  max: new Vector3(0.26, 1.67, 0.27).add(hostSpot),
}
// The speech bubble's anchor, above her spot rather than her head, which moves while she dances;
// her head's top is at about 1.59 above her feet
export const bubbleAnchor = new Vector3(0, 1.9, 0).add(hostSpot)

// The opening view: the line of sight and distance the stage has always had, from (1, 2, 4) at
// (0, 0.5, 0), raised and moved back with the stage, so it takes in the row and the host behind it
export const opening = new Vector3(1, 2.4, 3.25)
export const lookAt = new Vector3(0, 0.9, -0.75)
