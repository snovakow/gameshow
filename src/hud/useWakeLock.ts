import { useCallback, useEffect, useRef } from 'react'
import { useGame } from '../store.ts'

// Keeps the screen on through a show. The first request comes from the Start click, since Safari
// wants a press for it; the browser lets go whenever the page is hidden, so it's asked again when
// the page is back in view; and it's let go at the finale and when the page goes. Only a secure
// context has it, so a phone reaching the dev server over Wi-Fi goes without
export function useWakeLock() {
  const phase = useGame((s) => s.phase)
  const lock = useRef<WakeLockSentinel | null>(null)
  // Whether the show wants the screen kept on, which a request still in flight checks on arrival
  const wanted = useRef(false)
  const asking = useRef(false)

  const request = useCallback(() => {
    if (!('wakeLock' in navigator)) return
    wanted.current = true
    if (asking.current || (lock.current && !lock.current.released)) return
    asking.current = true
    navigator.wakeLock.request('screen').then(
      (sentinel) => {
        asking.current = false
        if (wanted.current) lock.current = sentinel
        else void sentinel.release()
      },
      // Refused, as on a low battery: the show goes on with the screen's own timeout
      () => {
        asking.current = false
      },
    )
  }, [])

  const release = useCallback(() => {
    wanted.current = false
    void lock.current?.release()
    lock.current = null
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (wanted.current && document.visibilityState === 'visible') request()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      release()
    }
  }, [request, release])

  // The finale ends the play, and Play again goes back to the title card
  useEffect(() => {
    if (phase === 'finale' || phase === 'title') release()
  }, [phase, release])

  return request
}
