import { createI18n } from 'vue-i18n'
import type { Locale } from '@/utils/weights'
import en from './en'
import fr from './fr'

const STORAGE_KEY = 'tp.lang'

function readSaved(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: readSaved(),
  fallbackLocale: 'fr',
  messages: { fr, en },
})

export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale
}

export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Storage unavailable: the language lasts for this tab only.
  }
}
