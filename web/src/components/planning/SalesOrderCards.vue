<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SalesOrder } from '@/api/types'
import { formatNumber, type Locale } from '@/utils/weights'

defineProps<{ items: SalesOrder[]; isSelected: (no: string) => boolean }>()
defineEmits<{ toggle: [order: SalesOrder] }>()

const { locale } = useI18n()
</script>

<template>
  <ul class="space-y-2">
    <li v-for="order in items" :key="order.no">
      <button
        type="button"
        role="checkbox"
        :aria-checked="isSelected(order.no)"
        class="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-teal-600"
        :class="isSelected(order.no) ? 'border-teal-600 bg-teal-50 shadow-[inset_3px_0_0_var(--color-load)]' : 'border-line'"
        @click="$emit('toggle', order)"
      >
        <span
          class="grid size-5 shrink-0 place-items-center rounded border-[1.5px] text-xs text-white"
          :class="isSelected(order.no) ? 'border-teal-700 bg-teal-700' : 'border-slate-400'"
          aria-hidden="true"
        >
          <i v-if="isSelected(order.no)" class="pi pi-check text-[10px]" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="tabular block font-semibold">{{ order.no }}</span>
          <span class="block truncate text-xs text-muted">{{ order.customerName }} · {{ order.deliveryCity }}</span>
        </span>
        <span class="text-right">
          <span class="tabular block font-semibold">{{ formatNumber(order.totalWeightKg, locale as Locale) }}</span>
          <span class="block text-xs text-muted">kg</span>
        </span>
      </button>
    </li>
  </ul>
</template>
