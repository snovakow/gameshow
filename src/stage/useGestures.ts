import { CameraControlsImpl } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, type RefObject } from 'react'
import { Spherical } from 'three'

const { ACTION } = CameraControlsImpl

// What one, two and three fingers do through the controls. Two pan by their midpoint and pinch
// here, by the ratio of their spread, so the stage keeps its size between them: camera-controls
// moves by the change in spread rather than its ratio, so the stage lagged the fingers
export const touches = {
  one: ACTION.TOUCH_ROTATE,
  two: ACTION.TOUCH_TRUCK,
  three: ACTION.TOUCH_TRUCK,
}

// A trackpad pinch arrives as a wheel with ctrl held, its delta the pinch's scale as a logarithm:
// the browser zooms a page by e^(-delta / 100). The camera moves by the inverse, so the stage
// grows and shrinks with the fingers
const pinchDelta = 100
// A wheel that counts in lines, as some mice do, at a typical line's height in CSS pixels
const lineHeight = 16

// The gestures camera-controls maps differently from the controls the stage had before: a trackpad
// pinch and a touch pinch follow the fingers, moving the camera within its distance limits, and the
// left button pans while shift or cmd is held. Each listener sits where the controls listen: a
// press or a wheel on their element, and a pinch's moves and lifts on the page. Those that must act
// first listen as the event comes down to the element, before the controls. A wheel and the
// pinches end a glide of the camera's through takeOver, since the controls announce neither
export function useGestures(
  controls: RefObject<CameraControlsImpl | null>,
  takeOver: () => void,
) {
  const gl = useThree((s) => s.gl)
  // The element R3F gives its events, as drei's controls connect to it; the canvas until it's set
  const connected: unknown = useThree((s) => s.events.connected)

  useEffect(() => {
    const cameraControls = controls.current
    if (!cameraControls) return undefined
    const element = connected instanceof HTMLElement ? connected : gl.domElement
    const page = element.ownerDocument
    const spherical = new Spherical()
    // From where the camera is headed, so moves within one frame add up rather than replace each
    // other; dollyTo keeps the distance limits
    const dollyBy = (scale: number) => {
      const distance = cameraControls.getSpherical(spherical, true).radius
      void cameraControls.dollyTo(distance * scale, true)
    }

    // Any wheel ends a glide, since the controls announce none. camera-controls turns a ctrl+wheel
    // into the lens's zoom, which the stage pins, so it would do nothing; the browser would zoom
    // the page instead
    const onWheel = (event: WheelEvent) => {
      takeOver()
      if (!event.ctrlKey) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? lineHeight
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? element.clientHeight
            : 1
      dollyBy(Math.exp((event.deltaY * unit) / pinchDelta))
    }

    // Read at the press, so a drag that lets go of the key midway keeps panning
    const onMouseDown = (event: PointerEvent) => {
      cameraControls.mouseButtons.left =
        event.shiftKey || event.metaKey ? ACTION.TRUCK : ACTION.ROTATE
    }

    // The fingers down on the stage, where each is now, and their spread when last applied, 0
    // while there aren't exactly two
    const fingers = new Map<number, { x: number; y: number }>()
    let spread = 0
    const measure = () => {
      if (fingers.size !== 2) return 0
      const [a, b] = [...fingers.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    // Only touches the controls also see: a press on the speech bubble is kept from them
    const onTouchDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      spread = measure()
    }
    const onTouchMove = (event: PointerEvent) => {
      const finger = fingers.get(event.pointerId)
      if (!finger) return
      finger.x = event.clientX
      finger.y = event.clientY
      const now = measure()
      if (spread > 0 && now > 0) {
        takeOver()
        dollyBy(spread / now)
      }
      spread = now
    }
    const onTouchUp = (event: PointerEvent) => {
      if (fingers.delete(event.pointerId)) spread = measure()
    }

    element.addEventListener('wheel', onWheel, { capture: true, passive: false })
    element.addEventListener('pointerdown', onMouseDown, { capture: true })
    element.addEventListener('pointerdown', onTouchDown)
    page.addEventListener('pointermove', onTouchMove)
    page.addEventListener('pointerup', onTouchUp)
    page.addEventListener('pointercancel', onTouchUp)
    return () => {
      element.removeEventListener('wheel', onWheel, { capture: true })
      element.removeEventListener('pointerdown', onMouseDown, { capture: true })
      element.removeEventListener('pointerdown', onTouchDown)
      page.removeEventListener('pointermove', onTouchMove)
      page.removeEventListener('pointerup', onTouchUp)
      page.removeEventListener('pointercancel', onTouchUp)
      cameraControls.mouseButtons.left = ACTION.ROTATE
    }
  }, [controls, connected, gl, takeOver])
}
