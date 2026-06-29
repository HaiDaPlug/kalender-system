// GSM-7 basic charset — each character counts as 1 septet
// Swedish å, ä, ö, Å, Ä, Ö are included here (basic GSM-7, not extended)
const GSM7_BASIC = new Set([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r', 'Å', 'å',
  'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', '\x1b', 'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
  '¡', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'Ä', 'Ö', 'Ñ', 'Ü', '§', '¿',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
  'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'ä', 'ö', 'ñ', 'ü', 'à',
])

// GSM-7 extended charset — each counts as 2 septets (escape prefix + char)
const GSM7_EXTENDED = new Set(['\f', '^', '{', '}', '\\', '[', '~', ']', '|', '€'])

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM7_BASIC.has(ch) && !GSM7_EXTENDED.has(ch)) return false
  }
  return true
}

function gsm7Length(text: string): number {
  let len = 0
  for (const ch of text) {
    len += GSM7_EXTENDED.has(ch) ? 2 : 1
  }
  return len
}

export interface SmsPartsResult {
  parts: number
  encoding: 'gsm7' | 'unicode'
  chars: number
}

export function calcSmsParts(text: string): SmsPartsResult {
  if (isGsm7(text)) {
    const chars = gsm7Length(text)
    const parts = chars <= 160 ? 1 : Math.ceil(chars / 153)
    return { parts, encoding: 'gsm7', chars }
  }
  const chars = text.length
  const parts = chars <= 70 ? 1 : Math.ceil(chars / 67)
  return { parts, encoding: 'unicode', chars }
}
