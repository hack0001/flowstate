'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Lang, translations, TKey } from '@/lib/i18n'

interface LangCtx {
  lang: Lang
  toggle: () => void
  t: (key: TKey) => string
  isCy: boolean
}

const LanguageContext = createContext<LangCtx>({
  lang: 'en',
  toggle: () => {},
  t: (key) => translations[key].en,
  isCy: false,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('flowstate_lang') as Lang
      if (saved === 'cy' || saved === 'en') setLang(saved)
    } catch {}
  }, [])

  function toggle() {
    setLang(prev => {
      const next: Lang = prev === 'en' ? 'cy' : 'en'
      try { localStorage.setItem('flowstate_lang', next) } catch {}
      return next
    })
  }

  function t(key: TKey): string {
    return translations[key][lang]
  }

  return (
    <LanguageContext.Provider value={{ lang, toggle, t, isCy: lang === 'cy' }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
