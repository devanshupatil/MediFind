# i18n Translation — Design Spec
**Date:** 2026-07-06  
**Status:** Approved  

## Overview

Replace the hand-rolled `strings.js` translation system with **i18next + react-i18next**. Support three languages: English, Hindi, Marathi. Marathi strings generated once via Google Translate free API. Language switching is instant (strings are bundled, no runtime API calls).

---

## File Structure

```
src/
  i18n/
    index.js              ← i18next initialisation (detection, fallback, resources)
    locales/
      en.json             ← English (source of truth, 13 keys)
      hi.json             ← Hindi (migrated from strings.js)
      mr.json             ← Marathi (generated via Google Translate script)
  lib/
    strings.js            ← DELETED
scripts/
  generate-mr.js          ← One-time script: translates en.json → mr.json via Google Translate
```

---

## Translation Keys

All 13 keys from current `strings.js` carried over verbatim:

```json
{
  "greeting": "Hello!",
  "tagline": "Find Your Medicine",
  "searchPlaceholder": "Search medicine name...",
  "voiceBtn": "Voice Search",
  "voiceListening": "Listening...",
  "scanBtn": "Scan",
  "callBtn": "Call",
  "inStock": "In Stock",
  "outOfStock": "Out of Stock",
  "noResults": "No medicines found",
  "noResultsHint": "Try a different name or call the store",
  "voiceUnsupported": "Voice search not supported on this browser",
  "lowStock": "Low Stock"
}
```

`en.json` is the source of truth. All other locales mirror these keys.

---

## i18next Setup (`src/i18n/index.js`)

```js
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import hi from './locales/hi.json'
import mr from './locales/mr.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, hi: { translation: hi }, mr: { translation: mr } },
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'mr'],
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
    interpolation: { escapeValue: false },
  })

export default i18n
```

- Language detection order: `localStorage` first (persists choice), then browser `navigator.language`
- Fallback: `en`
- All three locales are bundled — no lazy loading needed at this scale

---

## Language Switcher Component

New `<LanguageSwitcher />` component placed in the header of `SearchPage`.

```
[ English ]  [ हिन्दी ]  [ मराठी ]
```

- Three pill buttons, active pill is highlighted (filled blue), inactive pills are outlined/muted
- `useTranslation()` hook provides `i18n.changeLanguage(code)` and `i18n.language`
- Clicking a pill calls `i18n.changeLanguage(code)` → instantly re-renders all translated strings
- `localStorage` persistence is handled automatically by `i18next-browser-languagedetector`

---

## SearchPage Migration

| Before | After |
|--------|-------|
| `const [lang, setLang] = useState('hi')` | removed |
| `const s = strings[lang]` | removed |
| `s.searchPlaceholder` | `t('searchPlaceholder')` |
| Manual `<button onClick={() => setLang(...)}>`  | `<LanguageSwitcher />` |
| `import { strings }` | `import { useTranslation }` |

All `s.key` references replaced with `t('key')`. The `lang` and `setLang` state is removed entirely.

---

## Marathi Generation Script (`scripts/generate-mr.js`)

One-time Node script using Google Translate's free (unofficial) endpoint:

```
node scripts/generate-mr.js
```

- Reads `src/i18n/locales/en.json`
- For each value, calls Google Translate (`en` → `mr`)
- Writes result to `src/i18n/locales/mr.json`
- Committed to repo — never runs in production

---

## Packages to Install

```
i18next
react-i18next
i18next-browser-languagedetector
```

No paid API keys required. Marathi generation uses the free Google Translate endpoint (no authentication).

---

## What Is NOT Changed

- `AdminLoginPage` and `AdminDashboardPage` — English-only admin UI, no translation needed
- Medicine names from Supabase — dynamic data, not translated
- `CameraSearch` scanner UI — English-only (technical interface, minimal text)

---

## Success Criteria

1. All three language pills render in the header
2. Clicking any pill instantly updates all UI strings with no page reload
3. Chosen language persists on refresh (localStorage)
4. Browser language auto-detected on first visit
5. `strings.js` is deleted, no references remain
6. All existing tests pass
