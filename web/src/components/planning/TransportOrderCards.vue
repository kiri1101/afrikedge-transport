<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { TransportOrderSummary } from '@/api/types'
import LoadBar from '@/components/ui/LoadBar.vue'
import PlateChip from '@/components/ui/PlateChip.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import { formatDate } from '@/utils/dates'
import { loadLevel } from '@/utils/weights'

defineProps<{ items: TransportOrderSummary[] }>()

const { t } = useI18n()
const percent = (order: TransportOrderSummary) => Math.round((order.totalWeightKg / order.capacityKg) * 100)
</script>

<template>
  <ul class="space-y-2">
    <li v-for="order in items" :key="order.no">
      <RouterLink
        :to="`/transport-orders/${order.no}`"
        class="block rounded-xl border border-line bg-white p-3 focus-visible:outline-2 focus-visible:outline-teal-600"
      >
        <div class="flex items-center gap-2">
          <span class="tabular font-semibold">{{ order.no }}</span>
          <StatusTag :status="order.status" />
          <span class="tabular ml-auto text-xs text-muted">{{ formatDate(order.deliveryDate) }}</span>
        </div>
        <div class="my-2 flex items-center gap-2 text-xs text-muted">
          <PlateChip :plate-no="order.plateNo" />
          {{ t('transportOrders.lines', { n: order.lineCount }, order.lineCount) }}
        </div>
        <div class="flex items-center gap-2">
          <LoadBar
            class="flex-1"
            size="sm"
            :segments="order.totalWeightKg > 0 ? [{ key: order.no, label: order.no, kg: order.totalWeightKg }] : []"
            :capacity-kg="order.capacityKg"
          />
          <span
            class="tabular w-10 text-right text-xs"
            :class="loadLevel(order.totalWeightKg, order.capacityKg) === 'ok' ? '' : 'text-amber-700'"
            >{{ percent(order) }} %</span
          >
        </div>
      </RouterLink>
    </li>
  </ul>
</template>
