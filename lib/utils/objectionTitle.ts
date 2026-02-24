// Extract a short, scannable title from the full objection text.
// Strips PT-BR prefixes, cuts at punctuation, then at connecting words,
// and enforces a hard character limit for compact display.
export function getObjectionTitle(name: string): string {
  let text = name.trim()

  // Remove common leading words that add no meaning
  text = text
    .replace(/^(O |A |Os |As |Eu |Nós |Meu |Minha |Nosso |Nossa |Nossos |Nossas |Cliente )/i, '')
    .trim()

  // 1. Cut at first punctuation break if within range
  const breakChars = [',', ';', '. ', ' - ', ' — ', ' – ']
  for (const ch of breakChars) {
    const idx = text.indexOf(ch)
    if (idx > 0 && idx <= 55) {
      text = text.substring(0, idx).trim()
      break
    }
  }

  // 2. If still long, cut at Portuguese connecting words for natural break
  if (text.length > 45) {
    const connectors = [
      ' porque ', ' pois ', ' considerando ', ' já que ', ' uma vez que ',
      ' sendo que ', ' e não ', ' e apenas ', ' sem entender ', ' mas ',
      ' porém ', ' no entanto ', ' entretanto ', ' para que ', ' quando ',
      ' onde ', ' como algo ', ' como um ', ' como uma ', ' durante ',
    ]
    let earliestIdx = -1
    for (const conn of connectors) {
      const idx = text.toLowerCase().indexOf(conn)
      if (idx > 15 && idx <= 55 && (earliestIdx === -1 || idx < earliestIdx)) {
        earliestIdx = idx
      }
    }
    if (earliestIdx > 15) {
      text = text.substring(0, earliestIdx).trim()
    }
  }

  // 3. Hard limit: cut at last word boundary
  const maxLen = 55
  if (text.length > maxLen) {
    const truncated = text.substring(0, maxLen)
    const lastSpace = truncated.lastIndexOf(' ')
    text = (lastSpace > maxLen * 0.5 ? truncated.substring(0, lastSpace) : truncated).trim()
  }

  // Capitalize first letter
  return text.charAt(0).toUpperCase() + text.slice(1)
}
