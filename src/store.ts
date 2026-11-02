import { create } from 'zustand'

export interface CrateState {
  prize: string
  open: boolean
  // Bumped on every opening, so clicking an open crate swings its lid again (B8)
  openings: number
}

interface GameState {
  crates: CrateState[]
  open: (crate: number) => void
}

export const useGame = create<GameState>()((set) => ({
  crates: ['$0', '$1', '$2'].map((prize) => ({ prize, open: false, openings: 0 })),
  open: (crate) =>
    set((state) => ({
      crates: state.crates.map((c, i) =>
        i === crate ? { ...c, open: true, openings: c.openings + 1 } : c,
      ),
    })),
}))
