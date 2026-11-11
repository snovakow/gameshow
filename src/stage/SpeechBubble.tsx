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

const anchor = new Vector3()
const seen = new Vector3()

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
  // show the bubble whole: inside the room, then out of each HUD rectangle it overlaps, along the
  // shorter way out. An anchor behind the camera puts the bubble at the edge on the anchor's side
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
    const box = (cx: number, cy: number, below: number): Box => ({
      left: cx - width / 2,
      top: cy - height / 2,
      right: cx + width / 2,
      bottom: cy + height / 2 + below,
    })
    const inside = (b: Box) =>
      b.left >= bounds.left &&
      b.top >= bounds.top &&
      b.right <= bounds.right &&
      b.bottom <= bounds.bottom
    const meets = (a: Box, b: Box) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    const behind = seen.z > 0
    if (!behind) {
      const anchored = box(x, y, tail)
      if (inside(anchored) && !blocked.some((b) => meets(anchored, b))) {
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
    const clamp = (value: number, low: number, high: number) =>
      low > high ? (low + high) / 2 : Math.min(Math.max(value, low), high)
    x = clamp(x, bounds.left + width / 2, bounds.right - width / 2)
    y = clamp(y, bounds.top + height / 2, bounds.bottom - height / 2)
    for (let pass = 0; pass < 3; pass++) {
      let clear = true
      for (const b of blocked) {
        const now = box(x, y, 0)
        if (!meets(now, b)) continue
        clear = false
        const ways = [
          [b.left - now.right, 0],
          [b.right - now.left, 0],
          [0, b.top - now.bottom],
          [0, b.bottom - now.top],
        ]
          .filter(([dx, dy]) => inside(box(x + dx, y + dy, 0)))
          .sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]))
        if (ways.length) {
          x += ways[0][0]
          y += ways[0][1]
        }
      }
      if (clear) break
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
