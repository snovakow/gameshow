import { useSound } from '../audio/sounds.ts'

// Sound on or off, from the title card on, remembered for the next visit. A speaker, with waves
// while the sound is on and a cross while it's off
export function MuteButton() {
  const muted = useSound((s) => s.muted)
  const toggleMuted = useSound((s) => s.toggleMuted)

  return (
    <button
      type="button"
      className="mute"
      data-hud="mute"
      aria-label={muted ? 'Turn the sound on' : 'Turn the sound off'}
      onClick={toggleMuted}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  )
}
