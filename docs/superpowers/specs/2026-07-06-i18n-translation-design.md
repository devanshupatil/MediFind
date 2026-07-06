# i18n Translation — Design Spec
**Date:** 2026-07-06  
**Status:** Approved (v2 — post spec review)

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
    react: { useSuspense: false },
  })

export default i18n
```

- `react: { useSuspense: false }` prevents raw key flash on first render in React 18 StrictMode
- Language detection: `localStorage` first (persists choice), then `navigator.language`
- Fallback: `en`
- All three locales are bundled — no lazy loading needed at this scale

### `main.jsx` change

Add `import './i18n'` as the **first import** in `src/main.jsx`, before `ReactDOM.createRoot`. This initialises i18next as a side effect before React renders. Without it, every `t('key')` call returns the raw key string.

```js
import './i18n'   // ← must be first
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// ...
```

---

## Language Switcher Component

New `<LanguageSwitcher />` component placed in the header of `SearchPage`. **Replaces and deletes** the existing `sp-lang-btn` toggle button entirely — both the JSX and the `.sp-lang-btn` CSS class.

```
[ English ]  [ हिन्दी ]  [ मराठी ]
```

- Three pill buttons, active pill is highlighted (filled blue), inactive pills are outlined/muted
- `useTranslation()` hook provides `i18n.changeLanguage(code)` and `i18n.language`
- Clicking a pill calls `i18n.changeLanguage(code)` → instantly re-renders all translated strings
- `localStorage` persistence is handled automatically by `i18next-browser-languagedetector`

---

## SearchPage Migration

The top-level `SearchPage` and all internal subcomponents must be migrated.

### Top-level `SearchPage`

| Before | After |
|--------|-------|
| `const [lang, setLang] = useState('hi')` | removed |
| `const s = strings[lang]` | removed |
| `s.searchPlaceholder` | `t('searchPlaceholder')` |
| Manual `sp-lang-btn` toggle | `<LanguageSwitcher />` |
| `import { strings }` | `import { useTranslation } from 'react-i18next'` |

### Subcomponents: `MedicineCard`, `EmptyState`, `StockBadge`

All three consume `s = strings[lang]` via a `lang` prop. After migration:

- Remove `lang` prop from all three components
- Replace `const s = strings[lang]` with `const { t } = useTranslation()`
- Replace all `s.key` references with `t('key')`
- Remove `lang={lang}` from every `<MedicineCard ... />` call site

The `lang` state and prop are removed entirely from the SearchPage component tree.

---

## Test Setup

`src/__tests__/SearchPage.test.jsx` currently asserts on Hindi strings directly. After migration to i18next, jsdom's `navigator.language` defaults to `'en'`, so those assertions would fail.

**Fix:** mock `react-i18next` in the test setup file so `t(key)` returns the key itself (language-agnostic):

In `src/test-setup.js` (or `vitest.setup.js`), add:

```js
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn(), language: 'en' },
  }),
  Trans: ({ children }) => children,
}))
```

Then update all Hindi string assertions in `SearchPage.test.jsx` to use translation keys instead:

```js
// Before
expect(screen.getByText('उपलब्ध नहीं')).toBeInTheDocument()
// After
expect(screen.getByText('outOfStock')).toBeInTheDocument()
```

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

**Fallback:** If the free endpoint is unavailable, translate the 13 strings manually via translate.google.com and write `mr.json` by hand. The strings are short and a manual pass takes under 5 minutes.

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

1. All three language pills render in the header; `sp-lang-btn` is gone
2. Clicking any pill instantly updates all UI strings with no page reload
3. Chosen language persists on refresh (localStorage)
4. Browser language auto-detected on first visit (`en` fallback)
5. `strings.js` is deleted, no references remain
6. All existing tests pass with i18next mocked in test setup
