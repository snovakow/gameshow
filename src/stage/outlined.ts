import type { Object3D } from 'three'
import { create } from 'zustand'

interface Outlined {
  // The crates the outline marks, each by the group that draws its box
  crates: Object3D[]
  mark: (crate: Object3D, on: boolean) => void
}

// Which crates the outline marks: the one under the pointer while it can be chosen, and the
// player's choice. The crates keep it and the render pipeline's outline reads it
export const useOutlined = create<Outlined>((set) => ({
  crates: [],
  mark: (crate, on) =>
    set(({ crates }) => {
      if (crates.includes(crate) === on) return {}
      return { crates: on ? [...crates, crate] : crates.filter((c) => c !== crate) }
    }),
}))
