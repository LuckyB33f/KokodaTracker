// Server mirror of src/features/meals/utils/mealText.ts — keep the two in
// sync. The library doc ID is a deterministic hash of the normalised meal
// text, so offline queue replays collide onto one doc by construction
// (spec R9 dedupe requirement).

export function normaliseMealText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK = 0xffffffffffffffffn

export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte)
    hash = (hash * FNV_PRIME) & MASK
  }
  return hash.toString(16).padStart(16, '0')
}

export function libraryIdFor(text: string): string {
  return fnv1a64(normaliseMealText(text))
}
