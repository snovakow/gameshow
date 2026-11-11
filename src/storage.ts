// The browser's storage, which may be missing or refuse: a private window, blocked site data or a
// full quota throws, sometimes on merely naming the store. Every read then gives null and every
// write gives up quietly, so the page works the same without it, only forgetting

type Area = 'local' | 'session'

function storage(area: Area): Storage {
  return area === 'local' ? localStorage : sessionStorage
}

export function readStored(area: Area, key: string): string | null {
  try {
    return storage(area).getItem(key)
  } catch {
    return null
  }
}

// Whether it was kept
export function writeStored(area: Area, key: string, value: string): boolean {
  try {
    storage(area).setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStored(area: Area, key: string): boolean {
  try {
    storage(area).removeItem(key)
    return true
  } catch {
    return false
  }
}
