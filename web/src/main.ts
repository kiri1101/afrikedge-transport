import './assets/main.css'
import 'primeicons/primeicons.css'

import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'

import App from './App.vue'
import { i18n } from './i18n'
import router from './router'
import { TransportPreset } from './theme/preset'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(PrimeVue, {
  theme: {
    preset: TransportPreset,
    options: {
      // No dark mode (paired with color-scheme: light in main.css).
      darkModeSelector: false,
      cssLayer: { name: 'primevue', order: 'theme, base, primevue, components, utilities' },
    },
  },
})
app.use(ToastService)
app.use(ConfirmationService)

document.documentElement.lang = i18n.global.locale.value
app.mount('#app')
