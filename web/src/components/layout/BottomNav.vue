<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
// Sibling routes: /transport-orders/TO-0003 is not "active" for /transport-orders by Vue Router rules.
const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)

const links = [
  { to: '/sales-orders', icon: 'pi-list', label: 'nav.salesShort' },
  { to: '/transport-orders', icon: 'pi-truck', label: 'nav.ordersShort' },
]
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-20 flex h-16 border-t border-line bg-white" :aria-label="t('app.name')">
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="flex flex-1 flex-col items-center justify-center gap-1 text-xs text-muted"
      :class="{ '!text-teal-700 font-bold': isActive(link.to) }"
      :aria-current="isActive(link.to) ? 'page' : undefined"
    >
      <i class="pi text-lg" :class="link.icon" aria-hidden="true" />
      {{ t(link.label) }}
    </RouterLink>
  </nav>
</template>
