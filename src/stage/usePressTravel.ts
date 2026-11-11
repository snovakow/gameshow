import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

// A press whose pointer strays further than this, in CSS pixels, is a drag to look around and
// not a tap. R3F's own click distance is only the straight line from the press to the release,
// so a drag out and back would pass it
const maxTravel = 6

// Tells a tap from a drag for an object that takes clicks: its onPointerDown starts tracking a
// press, and isTap, asked once in its onClick, says whether the press that just ended began there
// and kept within a tap's travel
export function usePressTravel() {
  // How far the current press has strayed, or null when no press began on the object
  const travel = useRef<number | null>(null)
  const stopTracking = useRef<(() => void) | null>(null)

  useEffect(
    () => () => {
      stopTracking.current?.()
    },
    [],
  )

  // The press is tracked on the window for its whole length, since the pointer may leave the
  // object and come back before it's released
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    stopTracking.current?.()
    const { pointerId, clientX, clientY } = e.nativeEvent
    travel.current = 0
    const stray = (event: PointerEvent) => {
      const distance = Math.hypot(event.clientX - clientX, event.clientY - clientY)
      travel.current = Math.max(travel.current ?? 0, distance)
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerId === pointerId) stray(event)
    }
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      stray(event)
      stop()
    }
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      travel.current = null
      stop()
    }
    const stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      stopTracking.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    stopTracking.current = stop
  }

  const isTap = () => {
    const strayed = travel.current
    travel.current = null
    return strayed !== null && strayed <= maxTravel
  }

  return { onPointerDown, isTap }
}
