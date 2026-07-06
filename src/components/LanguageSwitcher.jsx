import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
]

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language?.split('-')[0] ?? 'en'

  return (
    <div className="sp-lang-switcher" role="group" aria-label="Select language">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={`sp-lang-pill${current === code ? ' sp-lang-pill--active' : ''}`}
          onClick={() => i18n.changeLanguage(code)}
          aria-pressed={current === code}
          aria-label={`Switch to ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
