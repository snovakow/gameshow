import { limits, linkPayload, linkVersion, validateConfig, type Config } from './config.ts'

// A gift travels in the page's fragment, after #gift=, which a browser never sends to a server:
// its settings as UTF-8 JSON in base64url, with no padding. The encoding keeps the amounts out of
// sight, not secret

// What went wrong with a link, so the page can say it in words that help
export type LinkProblem = 'length' | 'encoding' | 'json' | 'version' | 'settings'

export type DecodedLink =
  | { ok: true; config: Config }
  | { ok: false; problem: LinkProblem; errors: string[] }

const base64urlPattern = /^[A-Za-z0-9_-]+$/

// The settings as the link's text, without the #gift= before it
export function encodeLink(config: Config): string {
  const bytes = new TextEncoder().encode(JSON.stringify(linkPayload(config)))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const failure = (problem: LinkProblem, error: string): DecodedLink => ({
  ok: false,
  problem,
  errors: [error],
})

// Reads a link's text back into settings, checked as the setup page checks them. Bad bytes fail
// rather than turn into replacement characters, so a link damaged in transit is never shown
// as a gift with garbled names
export function decodeLink(payload: string): DecodedLink {
  if (payload.length > limits.link) {
    return failure('length', `The link is longer than ${limits.link} characters.`)
  }
  // Base64 never leaves a single character over in its last group of four
  if (!base64urlPattern.test(payload) || payload.length % 4 === 1) {
    return failure('encoding', 'The link has characters a gift link never has, or is cut short.')
  }
  let text: string
  try {
    const padded = payload.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return failure('encoding', "The link's text doesn't decode, so part of it is missing or changed.")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return failure('json', "The link's settings are incomplete, so part of it is missing or changed.")
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return failure('json', "The link doesn't hold a gift's settings.")
  }
  const version: unknown = new Map<string, unknown>(Object.entries(parsed)).get('v')
  if (typeof version === 'number' && version > linkVersion) {
    return failure('version', 'The link was made by a newer version of Gameshow.')
  }
  if (version !== linkVersion) {
    return failure('settings', "The link doesn't say which version of Gameshow made it.")
  }
  const validation = validateConfig(parsed, 'gift')
  if (!validation.ok) return { ok: false, problem: 'settings', errors: validation.errors }
  return { ok: true, config: validation.config }
}

// The page a fragment asks for. A gift's payload is passed on undecoded; &try=1 after it marks
// the setup page's trial run, which keeps no progress
export type HashRoute =
  | { page: 'demo' }
  | { page: 'setup' }
  | { page: 'gift'; payload: string; trial: boolean }

export function parseHash(hash: string): HashRoute {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (fragment === 'setup') return { page: 'setup' }
  if (!fragment.startsWith('gift=')) return { page: 'demo' }
  const [payload, ...rest] = fragment.slice('gift='.length).split('&')
  return { page: 'gift', payload, trial: rest.includes('try=1') }
}

// The fragment for a gift, or for its trial run
export function giftHash(payload: string, trial = false): string {
  return `#gift=${payload}${trial ? '&try=1' : ''}`
}

// 32-bit FNV-1a, in plain arithmetic rather than crypto.subtle, which only a secure context has
// and a phone on the LAN over plain HTTP lacks. Not for secrecy: it only tells links apart
const fnvOffset = 0x811c9dc5
const fnvPrime = 0x01000193

export function fnv1a(text: string): string {
  let hash = fnvOffset
  for (const byte of new TextEncoder().encode(text)) {
    hash = Math.imul(hash ^ byte, fnvPrime) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

// Where a gift's progress is kept in the browser, one key per link
export function progressKey(payload: string): string {
  return `gameshow:progress:${fnv1a(payload)}`
}
