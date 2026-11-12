// What the marquee over the stage spells out: the show's name in the demo, and on a gift its
// greeting to the recipient. Upper case, as a marquee is lettered, so a character the stage's
// typeface has only in lower case (ë but not Ë) still counts as missing where it is drawn
export const demoTitle = 'GAMESHOW'

export function marqueeTitle(gift: { occasion: string; name: string } | null): string {
  if (!gift) return demoTitle
  return `Happy ${gift.occasion.trim()}, ${gift.name.trim()}!`.toUpperCase()
}

// The characters of a text that a typeface lacks, each once, in the order they first appear
export function missingCharacters(text: string, glyphs: ReadonlySet<string>): string[] {
  return [...new Set(text)].filter((character) => !glyphs.has(character))
}
