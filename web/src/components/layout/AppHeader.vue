<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBreakpoint } from '@/composables/useBreakpoint'
import LangSwitch from './LangSwitch.vue'
import UserSwitcher from './UserSwitcher.vue'

const { t } = useI18n()
const route = useRoute()
// Sibling routes: /transport-orders/TO-0003 is not "active" for /transport-orders by Vue Router rules.
const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
const { isMobile, isDesktop } = useBreakpoint()

const links = [
  { to: '/sales-orders', label: 'nav.salesOrders', short: 'nav.salesShort' },
  { to: '/transport-orders', label: 'nav.transportOrders', short: 'nav.ordersShort' },
]
</script>

<template>
  <header class="sticky top-0 z-20 bg-ink text-slate-300">
    <div class="mx-auto flex h-14 max-w-6xl items-center gap-5 px-4 sm:px-6">
      <RouterLink to="/" class="flex items-center gap-2.5 text-white">
        <span class="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-700" aria-hidden="true">
          <i class="pi pi-truck text-sm text-white" />
        </span>
        <span class="leading-tight">
          <span class="block font-bold">{{ t('app.name') }}</span>
          <span class="block text-[10px] tracking-wider text-slate-400 uppercase">{{ t('app.tagline') }}</span>
        </span>
      </RouterLink>

      <nav v-if="!isMobile" class="flex h-full" :aria-label="t('app.name')">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center border-b-2 border-transparent px-3 font-medium hover:text-white"
          :class="{ '!border-teal-400 text-white': isActive(link.to) }"
          :aria-current="isActive(link.to) ? 'page' : undefined"
        >
          {{ isDesktop ? t(link.label) : t(link.short) }}
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-3">
        <LangSwitch v-if="!isMobile" />
        <UserSwitcher :compact="isMobile" />
      </div>
    </div>
  </header>
</template>
