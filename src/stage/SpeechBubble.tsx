import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef, type SyntheticEvent } from 'react'
import { Vector3, type Camera, type Object3D } from 'three'
import { useGame } from '../store.ts'

// Above the host's spot rather than her head, which moves while she dances; her head's top is at
// about 1.59
const position: [number, number, number] = [0, 1.9, 1]
// drei's default puts the bubble above every other layer of the page; this keeps it under the
// HUD, the panel and the frame-rate meter
const zIndexRange: [number, number] = [20, 0]
// The tail below the bubble, in CSS pixels, as index.css draws it
const tail = 8
// What the bubble keeps clear of: the HUD's tab and buttons, the frame-rate meter, and the panel's
// title bar, which is all of the panel while it's folded
const obstacles = '.hud .tab, .hud .buttons > *, .meter, .panel > div > :first-child'

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

// drei mounts the bubble inside the canvas's event element, so a press on it would also reach the
// crate or the camera controls behind it
const contain = (e: SyntheticEvent) => {
  e.stopPropagation()
}

// drei hides the bubble while its anchor is behind the camera; it stays shown, placed at an edge
const keepShown = () => undefined

// The placement runs every frame, so what it works with is kept between frames: the anchor, the box
// each test writes the bubble into, and the places tried for a moved bubble's centre, across and
// down, written over from the start each time rather than emptied, which would let go of their
// storage
const anchor = new Vector3()
const seen = new Vector3()
const spot: Box = { left: 0, top: 0, right: 0, bottom: 0 }
const triedX: number[] = []
const triedY: number[] = []
// A bubble set against an edge lands there to within rounding, which these tests allow, in CSS
// pixels
const slack = 0.01

// The bubble's box centred on (cx, cy), with the tail's height below it when it has one
function bubbleBox(b: Box, cx: number, cy: number, width: number, height: number, below: number) {
  b.left = cx - width / 2
  b.top = cy - height / 2
  b.right = cx + width / 2
  b.bottom = cy + height / 2 + below
  return b
}

// Whether a box lies within the room, and whether two boxes overlap, each to within the slack
function inside(b: Box, bounds: Box) {
  return (
    b.left >= bounds.left - slack &&
    b.top >= bounds.top - slack &&
    b.right <= bounds.right + slack &&
    b.bottom <= bounds.bottom + slack
  )
}

function meets(a: Box, b: Box) {
  return (
    a.left < b.right - slack &&
    b.left < a.right - slack &&
    a.top < b.bottom - slack &&
    b.top < a.bottom - slack
  )
}

function meetsAny(b: Box, blocked: Box[]) {
  for (let i = 0; i < blocked.length; i++) {
    if (meets(b, blocked[i])) return true
  }
  return false
}

// A value held within two limits, or midway between them where they cross, as they do for a bubble
// wider or taller than the room
function clamp(value: number, low: number, high: number) {
  return low > high ? (low + high) / 2 : Math.min(Math.max(value, low), high)
}

export function SpeechBubble() {
  const line = useGame((s) => s.line)
  const skipLine = useGame((s) => s.skipLine)
  const gl = useThree((s) => s.gl)

  const bubble = useRef<HTMLDivElement | null>(null)
  const sizes = useRef<ResizeObserver | null>(null)
  // The bubble's size, kept as it changes rather than measured each frame
  const extent = useRef({ width: 0, height: 0 })
  // In the canvas's pixels: the room the bubble may use, the canvas less the safe-area insets, and
  // the HUD's rectangles within it, read again whenever the page's elements or sizes change
  const room = useRef<{ bounds: Box; blocked: Box[] } | null>(null)
  // Whether the bubble sits away from its anchored place, where its tail would point at nothing
  const moved = useRef(false)

  useEffect(() => {
    const canvas = gl.domElement
    const page = canvas.ownerDocument
    const safe = page.createElement('div')
    safe.className = 'safe-area'
    page.body.append(safe)
    const resized = new ResizeObserver(() => read())
    // Each element is watched from when it appears until it goes, since watching one anew reports
    // its size at once and would read the page again
    const watched = new Set<Element>()
    const read = () => {
      const c = canvas.getBoundingClientRect()
      const s = safe.getBoundingClientRect()
      const local = (r: DOMRect | Box): Box => ({
        left: r.left - c.left,
        top: r.top - c.top,
        right: r.right - c.left,
        bottom: r.bottom - c.top,
      })
      const elements = [...page.querySelectorAll(obstacles)]
      const present = new Set<Element>([canvas, safe, ...elements])
      for (const element of watched) {
        if (present.has(element)) continue
        resized.unobserve(element)
        watched.delete(element)
      }
      for (const element of present) {
        if (watched.has(element)) continue
        resized.observe(element)
        watched.add(element)
      }
      room.current = {
        bounds: local({
          left: Math.max(c.left, s.left),
          top: Math.max(c.top, s.top),
          right: Math.min(c.right, s.right),
          bottom: Math.min(c.bottom, s.bottom),
        }),
        blocked: elements
          .map((element) => element.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map(local),
      }
    }
    // A HUD element coming or going, as the show moves on; the bubble's own changes included
    const changed = new MutationObserver(read)
    changed.observe(page.body, { childList: true, subtree: true })
    const view = page.defaultView
    view?.addEventListener('resize', read)
    read()

    const observer = new ResizeObserver(([entry]) => {
      const [box] = entry.borderBoxSize
      extent.current = { width: box.inlineSize, height: box.blockSize }
    })
    sizes.current = observer
    if (bubble.current) observer.observe(bubble.current)
    return () => {
      observer.disconnect()
      sizes.current = null
      changed.disconnect()
      resized.disconnect()
      view?.removeEventListener('resize', read)
      safe.remove()
    }
  }, [gl])

  const attach = (element: HTMLDivElement | null) => {
    bubble.current = element
    if (!element) return undefined
    element.classList.toggle('moved', moved.current)
    sizes.current?.observe(element)
    return () => {
      sizes.current?.unobserve(element)
    }
  }

  const setMoved = (value: boolean) => {
    if (moved.current === value) return
    moved.current = value
    bubble.current?.classList.toggle('moved', value)
  }

  // drei's placement, the anchor projected into the canvas, moved only as far as it must go to
  // show the bubble whole: into the room, then to the nearest place in it clear of every HUD
  // rectangle. An anchor behind the camera puts the bubble at the edge on the anchor's side. It
  // allocates only the position it returns, a new one each frame, since drei keeps the last to
  // compare with
  const place = (group: Object3D, camera: Camera, size: { width: number; height: number }) => {
    anchor.setFromMatrixPosition(group.matrixWorld)
    seen.copy(anchor).applyMatrix4(camera.matrixWorldInverse)
    anchor.project(camera)
    let x = ((anchor.x + 1) / 2) * size.width
    let y = ((1 - anchor.y) / 2) * size.height
    const { width, height } = extent.current
    const r = room.current
    if (!r || width === 0) {
      setMoved(false)
      return [x, y]
    }
    const { bounds, blocked } = r
    const behind = seen.z > 0
    if (!behind) {
      bubbleBox(spot, x, y, width, height, tail)
      if (inside(spot, bounds) && !meetsAny(spot, blocked)) {
        setMoved(false)
        return [x, y]
      }
    } else {
      // Far toward the anchor's side, to be brought back to the edge there
      const across = seen.x
      const up = -seen.y
      const length = Math.hypot(across, up) || 1
      x = size.width / 2 + (across / length) * size.width * 4
      y = size.height / 2 + (up / length) * size.height * 4
    }
    x = clamp(x, bounds.left + width / 2, bounds.right - width / 2)
    y = clamp(y, bounds.top + height / 2, bounds.bottom - height / 2)
    // Then the nearest place in the room clear of every HUD rectangle at once, since the nearest
    // way out of one can lead into another, as from the tab onto the buttons below it. That place
    // lies level with where the bubble is, or against an edge of the room or of a rectangle, on
    // each axis, so only those are tried
    if (meetsAny(bubbleBox(spot, x, y, width, height, 0), blocked)) {
      triedX[0] = x
      triedX[1] = bounds.left + width / 2
      triedX[2] = bounds.right - width / 2
      triedY[0] = y
      triedY[1] = bounds.top + height / 2
      triedY[2] = bounds.bottom - height / 2
      for (let i = 0; i < blocked.length; i++) {
        const b = blocked[i]
        const at = 3 + 2 * i
        triedX[at] = b.left - width / 2
        triedX[at + 1] = b.right + width / 2
        triedY[at] = b.top - height / 2
        triedY[at + 1] = b.bottom + height / 2
      }
      const tried = 3 + 2 * blocked.length
      let nearest = Infinity
      let bestX = x
      let bestY = y
      for (let i = 0; i < tried; i++) {
        const cx = triedX[i]
        for (let j = 0; j < tried; j++) {
          const cy = triedY[j]
          const distance = Math.hypot(cx - x, cy - y)
          if (distance >= nearest) continue
          bubbleBox(spot, cx, cy, width, height, 0)
          if (!inside(spot, bounds) || meetsAny(spot, blocked)) continue
          nearest = distance
          bestX = cx
          bestY = cy
        }
      }
      x = bestX
      y = bestY
    }
    setMoved(true)
    return [x, y]
  }

  return (
    <Html
      center
      position={position}
      zIndexRange={zIndexRange}
      calculatePosition={place}
      onOcclude={keepShown}
    >
      {line && (
        // Keyed by the line, so each one fades in afresh
        <div
          key={line.id}
          ref={attach}
          className="bubble"
          data-line={line.id}
          onPointerDown={contain}
          onPointerUp={contain}
          onClick={(e) => {
            e.stopPropagation()
            skipLine()
          }}
        >
          <span>{line.text}</span>
        </div>
      )}
    </Html>
  )
}
