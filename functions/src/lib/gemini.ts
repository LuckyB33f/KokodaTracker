// Minimal Gemini REST client (spec §2.1: flash tier, server-side only).
// The rolling alias tracks Google's current flash model — pinned versions
// get retired for "new users" after billing-plan migrations (gemini-2.5-flash
// started 404ing in July 2026), so the alias is the stable choice here.
export const GEMINI_MODEL = 'gemini-flash-latest'
const MODEL = GEMINI_MODEL

// API-level failures (billing, quota, auth) are tagged code 'gemini-api' so
// callers can stop retrying and surface the real reason instead of
// "invalid response twice". Messages are user-facing.
function apiError(status: number, detail: string): Error {
  const message =
    status === 429
      ? 'The AI service is out of credits or quota — check Gemini API billing in AI Studio, then try again.'
      : status === 401 || status === 403
        ? 'The AI service rejected the API key — check the GEMINI_API_KEY secret.'
        : `The AI service returned an error (HTTP ${status}) — try again shortly.`
  return Object.assign(new Error(message), {
    code: 'gemini-api',
    status,
    detail: detail.slice(0, 300),
  })
}

export function isGeminiApiError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'gemini-api'
}

export async function geminiJson(
  apiKey: string,
  prompt: string,
): Promise<unknown> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      }),
    },
  )
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw apiError(response.status, detail)
  }
  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no text')
  return JSON.parse(text) as unknown
}

export async function geminiText(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6 },
      }),
    },
  )
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw apiError(response.status, detail)
  }
  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no text')
  return text.trim()
}
