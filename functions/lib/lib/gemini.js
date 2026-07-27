"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiJson = geminiJson;
exports.geminiText = geminiText;
// Minimal Gemini REST client (spec §2.1: gemini-2.5-flash, server-side only).
const MODEL = 'gemini-2.5-flash';
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
        throw new Error(`Gemini HTTP ${response.status}: ${detail.slice(0, 300)}`);
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
        throw new Error(`Gemini HTTP ${response.status}: ${detail.slice(0, 300)}`);
    }
    const payload = (await response.json());
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text)
        throw new Error('Gemini returned no text');
    return text.trim();
}
//# sourceMappingURL=gemini.js.map