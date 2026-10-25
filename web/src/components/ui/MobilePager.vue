<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

/** Previous / next pager for the card lists on mobile (44 px touch targets). */
defineProps<{ page: number; pages: number }>()
defineEmits<{ change: [page: number] }>()

const { t } = useI18n()
</script>

<template>
  <nav class="mt-3 flex items-center justify-center gap-4 text-sm" :aria-label="t('pager.label')">
    <Button
      icon="pi pi-chevron-left"
      text
      rounded
      class="!size-11"
      :disabled="page <= 1"
      :aria-label="t('pager.previous')"
      @click="$emit('change', page - 1)"
    />
    <span class="tabular">{{ t('pager.page', { page, pages }) }}</span>
    <Button
      icon="pi pi-chevron-right"
      text
      rounded
      class="!size-11"
      :disabled="page >= pages"
      :aria-label="t('pager.next')"
      @click="$emit('change', page + 1)"
    />
  </nav>
</template>
