#!/usr/bin/env node
/**
 * generate-mr.js
 * One-time script: translates en.json → mr.json via Google Translate (free, unofficial).
 * Run: node scripts/generate-mr.js
 * Output is committed to the repo — never runs in production.
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const EN_PATH = resolve(__dirname, '../src/i18n/locales/en.json')
const MR_PATH = resolve(__dirname, '../src/i18n/locales/mr.json')

const en = JSON.parse(readFileSync(EN_PATH, 'utf-8'))

async function translate(text, targetLang = 'mr') {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
  const res = await fetch(url)
  const data = await res.json()
  // Response structure: [[["translatedText","originalText",...],...],...]
  return data[0].map(chunk => chunk[0]).join('')
}

async function main() {
  console.log('Translating en.json → mr.json via Google Translate...\n')
  const mr = {}

  for (const [key, value] of Object.entries(en)) {
    const translated = await translate(value)
    mr[key] = translated
    console.log(`  ${key}: "${value}" → "${translated}"`)
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  writeFileSync(MR_PATH, JSON.stringify(mr, null, 2) + '\n', 'utf-8')
  console.log(`\nWrote ${MR_PATH}`)
}

main().catch(err => {
  console.error('Translation failed:', err)
  process.exit(1)
})
