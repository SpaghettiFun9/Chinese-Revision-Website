# 汉语复习 · Chinese Revision Website

A single-page web app for revising Chinese vocabulary. Manage word lists by topic,
drill with a **Translation Quiz**, and practise handwriting with **Dictation (听写 / tīngxiě)**
using your browser's built-in text-to-speech. All data lives in your browser
(LocalStorage) — no account, no server.

## Stack

- **React 18** + **Vite** (fast SPA, no page reloads)
- **Tailwind CSS** for styling (mobile-first, responsive)
- **Web Speech API** (`zh-CN`) for dictation audio
- **LocalStorage** for persistence

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

To build for production:

```bash
npm run build
npm run preview
```

## Features

### 1. Vocabulary & topics
- Manual entry (Chinese / Pinyin / English) with a live tone-colored preview.
- Bulk import: paste tab- or comma-separated rows (`汉字 , pīnyīn , english`). Pinyin optional.
- **Photo import (AI)** — upload or snap a photo of a handwritten/printed vocab list and
  Google **Gemini** reads it, filling in any missing pinyin/English. Uses your own free
  [Google AI Studio](https://aistudio.google.com/apikey) key, stored only in your browser.
  HEIC (iPhone) photos are converted automatically. Review/edit rows before importing.
- Create topics (e.g. “Food”, “HSK 3”), assign/reassign words, search and edit inline.

### 2. Translation Quiz
- Shows the characters; you type the English.
- Case-insensitive, whitespace-tolerant validation with alternative-answer support
  (`/`, `,`, or “or”), plus lenient handling of `to …` and `a/an/the`.
- Instant ✓/✗ feedback. **Enter** submits, then **Enter** advances.
- Toggle pinyin hints with the **Show pinyin** button or **Alt + H**.

### 3. Dictation (Tīngxiě)
- Reads each word aloud (zh-CN), pauses a configurable interval (3–20s) for you to
  write it on paper, and repeats 1–3× before advancing.
- **Play / Pause / Replay / Skip** transport controls; adjustable speaking speed.
- Reveals the answer after each word with an optional self-grade (✓/✗).
- Gracefully warns if the browser has no TTS / no Chinese voice, and falls back to
  showing the character during the write step.

### 4. Advanced
- **Tone color-coding** — characters and pinyin are colored by tone
  (1 = red, 2 = yellow/amber, 3 = green, 4 = blue, neutral = gray). Works with both
  diacritic (`hǎo`) and numbered (`hao3`) pinyin.
- **SRS Lite** — words you miss gain weight and resurface more often; correct answers
  fade them out. A weighted queue is built for every session.
- **Session analytics** — accuracy %, correct/review counts, and a “words to review” list
  after every quiz or dictation.

## Project structure

```
src/
  App.jsx                  view state machine (dashboard ↔ quiz ↔ dictation ↔ summary)
  context/AppContext.jsx   reducer + LocalStorage persistence
  components/
    Dashboard.jsx          study launcher + management tabs
    TopicManager.jsx       create / rename / delete topics
    VocabInput.jsx         manual + bulk vocabulary entry
    WordList.jsx           browse / search / edit / delete words
    QuizMode.jsx           translation quiz + answer matching
    DictationMode.jsx      TTS pacing loop with transport controls
    Analytics.jsx          post-session summary
    ToneText.jsx           tone-colored hanzi & pinyin renderers
    ToneLegend.jsx         tone color key
  utils/
    pinyin.js              tone detection + numbered↔diacritic conversion
    speech.js              Web Speech API helpers
    srs.js                 SRS Lite weighting + queue builder
    storage.js             LocalStorage load/save
```
