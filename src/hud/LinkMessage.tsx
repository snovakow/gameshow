import type { LinkProblem } from '../game/link.ts'

const damaged =
  'Part of it is missing or changed, which can happen when a long link is copied in pieces or wrapped by a message. Ask whoever sent it to send it again, copied whole.'

// What a link that won't open most likely went through, and what the recipient can do about it
const explanations: Record<LinkProblem, string> = {
  length:
    "It's longer than any gift link, so something was added to it. Ask whoever sent it for the link again.",
  encoding: damaged,
  json: damaged,
  version:
    'It was made by a newer version of Gameshow than this page. Reloading may bring the newer one; if not, ask whoever sent it.',
  settings:
    "Its settings don't add up, so it may have been changed by hand. Ask whoever sent it to make the link again.",
}

// Shown in place of the show when a gift link can't be read, so the recipient never meets a
// broken stage
export function LinkMessage({ problem, errors }: { problem: LinkProblem; errors: string[] }) {
  return (
    <main className="page message" data-hud="message">
      <h1>This gift link doesn't open</h1>
      <p>{explanations[problem]}</p>
      {problem === 'settings' && (
        <ul className="details">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <p>
        {/* An empty fragment is the demo; the change of fragment loads it afresh */}
        <a className="button secondary" href="#">
          Play the demo show instead
        </a>
      </p>
    </main>
  )
}
