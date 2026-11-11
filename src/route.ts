import { decodeLink, parseHash, progressKey, type LinkProblem } from './game/link.ts'
import { parseProgress } from './game/progress.ts'
import { createScript } from './game/script.ts'
import { readStored } from './storage.ts'
import type { Gift } from './store.ts'

// What the page shows, read once from the fragment at load: a route change reloads the page, so
// no route is ever entered any other way
export type Route =
  | { page: 'demo' }
  | { page: 'setup' }
  | { page: 'gift'; gift: Gift }
  | { page: 'broken'; problem: LinkProblem; errors: string[] }

export function readRoute(hash: string): Route {
  const route = parseHash(hash)
  if (route.page !== 'gift') return route
  const link = decodeLink(route.payload)
  if (!link.ok) return { page: 'broken', problem: link.problem, errors: link.errors }
  const { config } = link
  // The setup page's trial starts fresh every time and keeps nothing
  const saveKey = route.trial ? null : progressKey(route.payload)
  const progress = saveKey ? parseProgress(readStored('local', saveKey), config) : null
  return {
    page: 'gift',
    gift: {
      config,
      title: createScript(config, 'gift')('title'),
      saveKey,
      saved: progress?.results ?? [],
      finished: progress?.finished ?? false,
    },
  }
}
