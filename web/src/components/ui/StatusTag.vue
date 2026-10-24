<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SalesOrderStatus, TransportOrderStatus } from '@/api/types'

const props = defineProps<{ status: TransportOrderStatus | SalesOrderStatus }>()
const { t } = useI18n()

const STYLES: Record<TransportOrderStatus | SalesOrderStatus, string> = {
  DRAFT: 'bg-slate-200 text-slate-700',
  VALIDATED: 'bg-blue-100 text-blue-700',
  DEPARTED: 'bg-emerald-100 text-emerald-700',
  TO_PLAN: 'bg-amber-100 text-amber-800',
  PLANNED: 'bg-blue-100 text-blue-700',
  IN_DELIVERY: 'bg-emerald-100 text-emerald-700',
}

const label = computed(() =>
  ['DRAFT', 'VALIDATED', 'DEPARTED'].includes(props.status)
    ? t(`status.transportOrder.${props.status}`)
    : t(`status.salesOrder.${props.status}`),
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
    :class="STYLES[status]"
  >
    <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
    {{ label }}
  </span>
</template>
