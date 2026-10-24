<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TransportOrderSummary } from '@/api/types'
import LoadBar from '@/components/ui/LoadBar.vue'
import PlateChip from '@/components/ui/PlateChip.vue'
import { formatDate } from '@/utils/dates'
import { excessKg, fitsIn, formatKg, formatNumber, type Locale } from '@/utils/weights'

const props = defineProps<{ order: TransportOrderSummary; addKg: number; selected: boolean }>()
const emit = defineEmits<{ select: [] }>()

const { t, locale } = useI18n()
const kg = (value: number) => formatKg(value, locale.value as Locale)

const fits = computed(() => fitsIn(props.order.totalWeightKg, props.order.capacityKg, props.addKg))
const excess = computed(() => excessKg(props.order.totalWeightKg, props.order.capacityKg, props.addKg))
const after = computed(() => props.order.totalWeightKg + props.addKg)
const percent = computed(() => Math.round((after.value / props.order.capacityKg) * 100))
const segments = computed(() =>
  props.order.totalWeightKg > 0 ? [{ key: 'current', label: props.order.no, kg: props.order.totalWeightKg }] : [],
)

function choose(): void {
  if (fits.value) emit('select')
}
</script>

<template>
  <div
    role="radio"
    :aria-checked="selected"
    :aria-disabled="!fits"
    :tabindex="fits ? 0 : -1"
    class="block rounded-xl border-[1.5px] bg-white p-3 transition-shadow focus-visible:outline-2 focus-visible:outline-teal-600"
    :class="[
      selected ? 'border-teal-700 ring-4 ring-teal-50' : 'border-line',
      fits ? 'cursor-pointer hover:border-teal-400' : 'cursor-not-allowed bg-slate-50',
    ]"
    @click="choose"
    @keydown.enter.prevent="choose"
    @keydown.space.prevent="choose"
  >
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <span
        class="size-4 shrink-0 rounded-full border-[1.5px]"
        :class="selected ? 'border-[5px] border-teal-700' : 'border-slate-400'"
        aria-hidden="true"
      />
      <span class="tabular font-semibold">{{ order.no }}</span>
      <PlateChip :plate-no="order.plateNo" />
      <span class="tabular text-xs text-muted">{{ formatDate(order.deliveryDate) }}</span>
      <span class="ml-auto text-xs font-semibold" :class="fits ? 'text-emerald-700' : 'text-red-700'">
        <i class="pi mr-1" :class="fits ? 'pi-check' : 'pi-times'" aria-hidden="true" />
        {{ fits ? t('dialog.fits') : t('dialog.exceeds', { kg: kg(excess) }) }}
      </span>
    </div>
    <LoadBar :segments="segments" :capacity-kg="order.capacityKg" :projected-kg="addKg" />
    <div class="mt-1.5 flex justify-between gap-2 text-xs text-muted">
      <span class="tabular">{{ t('dialog.load', { used: formatNumber(after, locale as Locale), capacity: kg(order.capacityKg) }) }}</span>
      <span v-if="fits">{{ t('dialog.free', { pct: percent, kg: kg(order.capacityKg - after) }) }}</span>
      <span v-else class="tabular">{{ percent }} %</span>
    </div>
  </div>
</template>
