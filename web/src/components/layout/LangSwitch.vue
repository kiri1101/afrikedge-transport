<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'
import type { Locale } from '@/utils/weights'

const { t, locale } = useI18n()
const locales: Locale[] = ['fr', 'en']
</script>

<template>
  <div class="flex overflow-hidden rounded-md border border-ink-line text-xs font-semibold" role="group" :aria-label="t('lang.label')">
    <button
      v-for="code in locales"
      :key="code"
      type="button"
      class="px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
      :class="locale === code ? 'bg-ink-2 text-white' : 'text-slate-400 hover:text-white'"
      :aria-pressed="locale === code"
      @click="setLocale(code)"
    >
      {{ t(`lang.${code}`) }}
    </button>
  </div>
</template>
