"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEMINI_MODEL = void 0;
exports.isGeminiApiError = isGeminiApiError;
exports.geminiJson = geminiJson;
exports.geminiText = geminiText;
// Minimal Gemini REST client (spec §2.1: flash tier, server-side only).
// The rolling alias tracks Google's current flash model — pinned versions
// get retired for "new users" after billing-plan migrations (gemini-2.5-flash
// started 404ing in July 2026), so the alias is the stable choice here.
exports.GEMINI_MODEL = 'gemini-flash-latest';
const MODEL = exports.GEMINI_MODEL;
// API-level failures (billing, quota, auth) are tagged code 'gemini-api' so
// callers can stop retrying and surface the real reason instead of
// "invalid response twice". Messages are user-facing.
function apiError(status, detail) {
    const message = status === 429
        ? 'The AI service is out of credits or quota — check Gemini API billing in AI Studio, then try again.'
        : status === 401 || status === 403
            ? 'The AI service rejected the API key — check the GEMINI_API_KEY secret.'
            : `The AI service returned an error (HTTP ${status}) — try again shortly.`;
    return Object.assign(new Error(message), {
        code: 'gemini-api',
        status,
        detail: detail.slice(0, 300),
    });
}
function isGeminiApiError(error) {
    return error?.code === 'gemini-api';
}
async function geminiJson(apiKey, prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.4,
            },
        }),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw apiError(response.status, detail);
    }
    const payload = (await response.json());
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text)
        throw new Error('Gemini returned no text');
    return JSON.parse(text);
}
async function geminiText(apiKey, prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6 },
        }),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw apiError(response.status, detail);
    }
    const payload = (await response.json());
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text)
        throw new Error('Gemini returned no text');
    return text.trim();
}
//# sourceMappingURL=gemini.js.map