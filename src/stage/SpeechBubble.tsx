import { Html } from '@react-three/drei'
import type { SyntheticEvent } from 'react'
import { useGame } from '../store.ts'

// Above the host's spot rather than her head, which moves while she dances; her head's top is at
// about 1.59
const position: [number, number, number] = [0, 1.9, 1]
// drei's default puts the bubble above every other layer of the page; this keeps it under the
// HUD, the panel and the frame-rate meter
const zIndexRange: [number, number] = [20, 0]

// drei mounts the bubble inside the canvas's event element, so a press on it would also reach the
// crate or the camera controls behind it
const contain = (e: SyntheticEvent) => {
  e.stopPropagation()
}

export function SpeechBubble() {
  const line = useGame((s) => s.line)
  const skipLine = useGame((s) => s.skipLine)

  return (
    <Html center position={position} zIndexRange={zIndexRange}>
      {line && (
        // Keyed by the line, so each one fades in afresh
        <div
          key={line.id}
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
