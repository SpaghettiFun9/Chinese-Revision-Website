// ---------------------------------------------------------------------------
// AI vocabulary extraction from a photo of a handwritten (or printed) list.
//
// Uses the official Anthropic SDK directly from the browser with the user's own
// API key. Claude reads the image and returns a structured JSON list of
// {hanzi, pinyin, english}; structured outputs guarantee the shape.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk'
import { splitDataUrl } from './image.js'

export const DEFAULT_MODEL = 'claude-opus-4-8'

export const MODEL_OPTIONS = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8 — most accurate (recommended)' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5 — faster, cheaper' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — fastest, cheapest' },
]

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

Return the entries via the required JSON schema.`

const SCHEMA = {
  type: 'object',
  properties: {
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          hanzi: { type: 'string' },
          pinyin: { type: 'string' },
          english: { type: 'string' },
        },
        required: ['hanzi', 'pinyin', 'english'],
        additionalProperties: false,
      },
    },
  },
  required: ['words'],
  additionalProperties: false,
}

/**
 * Send the image to Claude and get back parsed vocabulary rows.
 * @param {{ apiKey: string, model?: string, imageDataUrl: string }} args
 * @returns {Promise<Array<{hanzi:string,pinyin:string,english:string}>>}
 */
export async function parseVocabImage({ apiKey, model, imageDataUrl }) {
  if (!apiKey) throw new Error('Please add your Anthropic API key first.')
  const { mediaType, base64 } = splitDataUrl(imageDataUrl)

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true, // user-supplied key, personal local app
  })

  let response
  try {
    response = await client.messages.create({
      model: model || DEFAULT_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })
  } catch (err) {
    throw new Error(friendlyError(err))
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to process this image. Try a clearer photo of the vocabulary list.')
  }

  const textBlock = (response.content || []).find((b) => b.type === 'text')
  if (!textBlock?.text) throw new Error('No response was returned. Please try again.')

  let parsed
  try {
    parsed = JSON.parse(textBlock.text)
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

function friendlyError(err) {
  const status = err?.status
  if (status === 401) return 'Invalid API key. Check the key and try again.'
  if (status === 403) return "This API key doesn't have access to the selected model."
  if (status === 404) return 'Model not found for this key. Try a different model.'
  if (status === 429) return 'Rate limit hit. Wait a moment and try again.'
  if (status === 413) return 'The image is too large. Try a smaller photo.'
  if (status >= 500) return 'The service is temporarily unavailable. Try again shortly.'
  // Network / CORS / other
  return err?.message
    ? `Request failed: ${err.message}`
    : 'Request failed. Check your connection and API key.'
}
