import { computed, readonly, ref } from 'vue'

// Same breakpoints as Tailwind's sm (640 px) and lg (1024 px).
const MOBILE = '(max-width: 639px)'
const DESKTOP = '(min-width: 1024px)'

const isMobile = ref(false)
const isDesktop = ref(true)
let listening = false

function listen(): void {
  if (listening || typeof window === 'undefined' || !window.matchMedia) return
  listening = true
  const mobile = window.matchMedia(MOBILE)
  const desktop = window.matchMedia(DESKTOP)
  isMobile.value = mobile.matches
  isDesktop.value = desktop.matches
  mobile.addEventListener('change', (event) => (isMobile.value = event.matches))
  desktop.addEventListener('change', (event) => (isDesktop.value = event.matches))
}

/**
 * Viewport size class, shared by the whole app (one pair of listeners).
 * Used to mount either a table or cards — never both hidden by CSS.
 */
export function useBreakpoint() {
  listen()
  return {
    isMobile: readonly(isMobile),
    isDesktop: readonly(isDesktop),
    isTablet: computed(() => !isMobile.value && !isDesktop.value),
  }
}
