// ---------------------------------------------------------------------------
// AI vocabulary extraction from a photo of a handwritten (or printed) list.
//
// Uses the free Google AI Studio (Gemini) API directly from the browser with
// the user's own API key. Gemini reads the image and returns a structured JSON
// list of {hanzi, pinyin, english}; a responseSchema guarantees the shape.
// ---------------------------------------------------------------------------

import { splitDataUrl } from './image.js'

export const DEFAULT_MODEL = 'gemini-2.5-flash'

export const MODEL_OPTIONS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — recommended (free)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — fastest (free)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — most accurate (free tier)' },
]

const endpoint = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const SYSTEM = `You are a meticulous Mandarin Chinese teacher and OCR expert. You read photos of vocabulary lists — often handwritten — and transcribe them into clean, structured data.`

const PROMPT = `This image is a Chinese vocabulary list. It may be handwritten and may contain any of: Chinese characters (Hanzi), Pinyin, and English meanings — sometimes only some of these per row.

For every vocabulary entry you can identify, output an object with:
- "hanzi": the Chinese characters (simplified unless the writer clearly used traditional). If the row only has pinyin/English, write the most standard Hanzi for that word.
- "pinyin": Hanzi Pinyin WITH tone marks (diacritics), lowercase, syllables separated by spaces (e.g. "nǐ hǎo"). Always provide this, inferring it from the Hanzi if it isn't written.
- "english": a concise English translation. Provide it even if it isn't written in the image.

Rules:
- Preserve the list's original order.
- Skip headings, page numbers, dates, and decorations — only real vocabulary entries.
- If handwriting is ambiguous, use your best judgment for the most likely intended word.
- Do not invent entries that aren't present.

Return the entries as JSON matching the required schema.`

// Gemini uses the OpenAPI-subset schema format (uppercase type names).
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    words: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          hanzi: { type: 'STRING' },
          pinyin: { type: 'STRING' },
          english: { type: 'STRING' },
        },
        required: ['hanzi', 'pinyin', 'english'],
      },
    },
  },
  required: ['words'],
}

/**
 * Send the image to Gemini and get back parsed vocabulary rows.
 * @param {{ apiKey: string, model?: string, imageDataUrl: string }} args
 * @returns {Promise<Array<{hanzi:string,pinyin:string,english:string}>>}
 */
export async function parseVocabImage({ apiKey, model, imageDataUrl }) {
  if (!apiKey) throw new Error('Please add your Google AI Studio API key first.')
  const chosen = model || DEFAULT_MODEL
  const { mediaType, base64 } = splitDataUrl(imageDataUrl)

  const generationConfig = {
    temperature: 0,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
  }
  // Gemini 2.5 Flash "thinks" by default, which can eat the output budget on a
  // simple extraction — turn it off so all tokens go to the answer.
  if (/2\.5-flash/.test(chosen)) generationConfig.thinkingConfig = { thinkingBudget: 0 }

  let res
  try {
    res = await fetch(endpoint(chosen), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey, // key in a header, never the URL
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: mediaType, data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig,
      }),
    })
  } catch {
    throw new Error('Network error. Check your connection and try again.')
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    /* leave data null */
  }

  if (!res.ok) throw new Error(friendlyError(res.status, data))

  if (data?.promptFeedback?.blockReason) {
    throw new Error('The image was blocked by Gemini’s safety filters. Try a clear photo of just the vocabulary list.')
  }

  const cand = data?.candidates?.[0]
  const finish = cand?.finishReason
  if (finish && finish !== 'STOP' && finish !== 'MAX_TOKENS') {
    throw new Error('Gemini could not process this image. Try a clearer, well-lit photo.')
  }

  const text = (cand?.content?.parts || [])
    .map((p) => p.text)
    .filter(Boolean)
    .join('')
  if (!text) throw new Error('No response was returned. Please try again.')

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Could not read the AI response. Please try again.')
  }

  const words = Array.isArray(parsed?.words) ? parsed.words : []
  return words
    .map((w) => ({
      hanzi: String(w.hanzi || '').trim(),
      pinyin: String(w.pinyin || '').trim(),
      english: String(w.english || '').trim(),
    }))
    .filter((w) => w.hanzi && w.english)
}

function friendlyError(status, data) {
  const msg = data?.error?.message || ''
  const statusStr = data?.error?.status || ''
  const hay = `${msg} ${statusStr}`

  if (status === 400 && /API key not valid|API_KEY_INVALID|invalid.*key/i.test(hay)) {
    return 'Invalid API key. Get a free key at aistudio.google.com/apikey and paste it above.'
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate/i.test(hay)) {
    return "You've hit the free-tier rate limit. Wait a minute and try again (or switch to Gemini 2.0 Flash)."
  }
  if (status === 403) {
    return msg || 'Access denied. Check the API key and that the Generative Language API is enabled.'
  }
  if (status === 404) {
    return 'That model isn’t available for this key. Try a different Gemini model.'
  }
  if (status >= 500) return 'Gemini is temporarily unavailable. Try again shortly.'
  return msg ? `Request failed: ${msg}` : 'Request failed. Check your API key and try again.'
}
