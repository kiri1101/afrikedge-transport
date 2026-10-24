import { useI18n } from 'vue-i18n'
import { ApiError } from '@/api/http'
import { formatKg, type Locale } from '@/utils/weights'

/** Translates an API error by its code, formatting kg amounts and lists for the current language. */
export function useApiError() {
  const { t, te, locale } = useI18n()

  function errorMessage(error: unknown): string {
    if (!(error instanceof ApiError)) return t('errors.UNKNOWN')
    const key = `errors.${error.code}`
    if (!te(key)) return error.detail || error.title || t('errors.UNKNOWN')

    const params: Record<string, string> = {}
    for (const [name, value] of Object.entries(error.params)) {
      if (Array.isArray(value)) params[name] = value.join(', ')
      else if (typeof value === 'number' && name.endsWith('Kg')) params[name] = formatKg(value, locale.value as Locale)
      else params[name] = String(value)
    }
    return t(key, params)
  }

  return { errorMessage }
}
