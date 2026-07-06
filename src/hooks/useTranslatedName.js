/**
 * useTranslatedName
 *
 * Translates a single text string to the current i18n language using the
 * free (unofficial) Google Translate endpoint. Results are cached in a
 * module-level Map so identical strings are never fetched twice per session.
 *
 * - Returns the original text immediately (no flicker on first render)
 * - Swaps to the translated string asynchronously
 * - For 'en' locale → always returns the original (no network request)
 * - Cache is keyed by `${lang}:${text}` so switching languages re-fetches
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Module-level cache: survives re-renders, shared across all component instances
export const translationCache = new Map()

async function googleTranslate(text, targetLang) {
  const cacheKey = `${targetLang}:${text}`
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)
  }

  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`

  const res = await fetch(url)
  const data = await res.json()
  // Response: [[["translatedText","originalText",...], ...], ...]
  const translated = data[0].map(chunk => chunk[0]).join('')

  translationCache.set(cacheKey, translated)
  return translated
}

export function useTranslatedName(originalName) {
  const { i18n } = useTranslation()
  const lang = i18n.language?.split('-')[0] ?? 'en'

  const [translatedName, setTranslatedName] = useState(originalName)

  useEffect(() => {
    // Always reset to original immediately on name or language change
    setTranslatedName(originalName)

    // English — no translation needed
    if (lang === 'en') return

    let cancelled = false

    googleTranslate(originalName, lang)
      .then(result => {
        if (!cancelled) setTranslatedName(result)
      })
      .catch(() => {
        // Silently fall back to original name on any network error
      })

    return () => {
      cancelled = true
    }
  }, [originalName, lang])

  return translatedName
}
