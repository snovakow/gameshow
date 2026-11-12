import { MeshPhongMaterial, type Material } from 'three'
import { create } from 'zustand'

export const fontUrl = `${import.meta.env.BASE_URL}fonts/optimer_bold.typeface.json`

// Gold for a prize, the crates' numbers and the marquee's letters, grey for an empty crate, as the
// daylight stage has always drawn them; shared for the life of the page
export const gold = new MeshPhongMaterial({ color: 0xffd700 })
export const grey = new MeshPhongMaterial({ color: 0x8a8a8a })

// The gold and grey the stage draws with now: the ones above, or, while the studio's gold shines,
// metals that reflect a room of their own
export interface Metals {
  gold: Material
  grey: Material
}

export const useMetals = create<Metals>(() => ({ gold, grey }))
