// Unambiguous alphabet (no 0/O, 1/I/L) — codes get read out loud on a trail.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function generateInviteCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length]
  }
  return code
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase()
}
