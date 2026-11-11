import { MeshPhongMaterial } from 'three'

export const fontUrl = `${import.meta.env.BASE_URL}fonts/optimer_bold.typeface.json`

// Gold for a prize and the crates' numbers, grey for an empty crate; shared for the life of the
// page
export const gold = new MeshPhongMaterial({ color: 0xffd700 })
export const grey = new MeshPhongMaterial({ color: 0x8a8a8a })
