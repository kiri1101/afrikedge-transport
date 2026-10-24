<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
      active-class="!text-teal-700 font-bold"
    >
      <i class="pi text-lg" :class="link.icon" aria-hidden="true" />
      {{ t(link.label) }}
    </RouterLink>
  </nav>
</template>
