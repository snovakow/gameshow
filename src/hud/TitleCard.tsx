import { useProgress } from '@react-three/drei'
import { useState } from 'react'

interface TitleCardProps {
  onStart: () => void
  // A gift's greeting, or null in the demo
  title: string | null
  // A gift reopened partway through, which carries on from its next round
  resuming: boolean
}

// The show's opening card: a gift's greeting, how far the host and her moves have loaded, the
// Start button once they have, and in the demo the way to make a show as a gift
export function TitleCard({ onStart, title, resuming }: TitleCardProps) {
  // Every model, clip, texture and font the stage loads, counted as files rather than bytes
  const { active, progress } = useProgress()
  const loading = active || progress < 100
  // A file that starts loading late lowers the share already loaded; the bar holds its furthest
  // point rather than stepping back
  const [furthest, setFurthest] = useState(0)
  if (progress > furthest) setFurthest(progress)
  const shown = loading ? Math.max(furthest, progress) : 100
  const percent = Math.round(shown)

  return (
    <div className="title-card" data-hud="title">
      {title && (
        <h1 className="greeting" data-hud="greeting">
          {title}
        </h1>
      )}
      <div
        className="loading"
        role="progressbar"
        aria-label="Loading the show"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        data-hud="loading"
      >
        <div className="bar" style={{ transform: `scaleX(${shown / 100})` }} />
      </div>
      <p className="status">{loading ? `Loading the show… ${percent}%` : 'The show is ready'}</p>
      <div className="actions">
        {/* Not before the host is on stage to run it */}
        <button type="button" data-hud="start" disabled={loading} onClick={onStart}>
          {resuming ? 'Carry on with the show' : 'Start the show'}
        </button>
        {title === null && (
          <a className="secondary" href="#setup" data-hud="setup">
            Make a show as a gift
          </a>
        )}
      </div>
    </div>
  )
}
