import PrimeVue from 'primevue/config'
import { i18n } from '@/i18n'

/** Plugins every component test needs: translations and PrimeVue (unstyled, which is faster). */
export const testGlobal = {
  plugins: [i18n, [PrimeVue, { unstyled: true }]] as never[],
  // PrimeVue dialogs teleport to <body>; render them in place so the test can find them.
  stubs: { teleport: true },
}
