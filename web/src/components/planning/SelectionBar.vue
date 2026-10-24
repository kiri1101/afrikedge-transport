<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { formatKg, type Locale } from '@/utils/weights'

defineProps<{ count: number; weightKg: number }>()
defineEmits<{ add: []; clear: [] }>()

const { t, locale } = useI18n()
const { isMobile } = useBreakpoint()
</script>

<template>
  <div
    class="z-10 flex items-center gap-3 bg-ink px-4 py-3 text-slate-300 shadow-lg"
    :class="isMobile ? 'fixed inset-x-0 bottom-16' : 'sticky bottom-4 mt-4 rounded-xl'"
    role="region"
    :aria-label="t('selection.count', { n: count }, count)"
  >
    <div class="leading-tight">
      <span class="block font-semibold text-white">{{ t('selection.count', { n: count }, count) }}</span>
      <span class="tabular text-sm text-teal-300">{{ formatKg(weightKg, locale as Locale) }}</span>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <Button
        v-if="!isMobile"
        text
        size="small"
        class="!text-slate-300"
        :label="t('selection.clear')"
        @click="$emit('clear')"
      />
      <Button
        icon="pi pi-arrow-right"
        icon-pos="right"
        :label="isMobile ? t('selection.addShort') : t('selection.add')"
        @click="$emit('add')"
      />
    </div>
  </div>
</template>
