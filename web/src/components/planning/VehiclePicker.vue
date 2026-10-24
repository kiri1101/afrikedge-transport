<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Vehicle } from '@/api/types'
import PlateChip from '@/components/ui/PlateChip.vue'
import { formatKg, toHundredths, type Locale } from '@/utils/weights'

const props = defineProps<{
  vehicles: Vehicle[]
  /** vehicleCode → transport order already planned that day. */
  booked: Record<string, string>
  minCapacityKg: number
  modelValue: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [code: string] }>()

const { t, locale } = useI18n()

/** Why a vehicle cannot be chosen, or null when it can. */
function reason(vehicle: Vehicle): string | null {
  const bookedNo = props.booked[vehicle.code]
  if (bookedNo) return t('dialog.vehicleBooked', { no: bookedNo })
  if (toHundredths(vehicle.capacityKg) < toHundredths(props.minCapacityKg)) return t('dialog.vehicleTooSmall')
  return null
}

function choose(vehicle: Vehicle): void {
  if (!reason(vehicle)) emit('update:modelValue', vehicle.code)
}
</script>

<template>
  <div role="radiogroup" class="space-y-1.5">
    <p v-if="vehicles.length === 0" class="text-sm text-muted">{{ t('dialog.noVehicles') }}</p>
    <div
      v-for="vehicle in vehicles"
      :key="vehicle.code"
      :data-vehicle="vehicle.code"
      role="radio"
      :aria-checked="modelValue === vehicle.code"
      :aria-disabled="reason(vehicle) !== null"
      :tabindex="reason(vehicle) ? -1 : 0"
      class="flex min-h-11 items-center gap-2.5 rounded-lg border-[1.5px] bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-teal-600"
      :class="[
        modelValue === vehicle.code ? 'border-teal-700 ring-4 ring-teal-50' : 'border-line',
        reason(vehicle) ? 'cursor-not-allowed bg-slate-50 opacity-60' : 'cursor-pointer hover:border-teal-400',
      ]"
      @click="choose(vehicle)"
      @keydown.enter.prevent="choose(vehicle)"
      @keydown.space.prevent="choose(vehicle)"
    >
      <span
        class="size-4 shrink-0 rounded-full border-[1.5px]"
        :class="modelValue === vehicle.code ? 'border-[5px] border-teal-700' : 'border-slate-400'"
        aria-hidden="true"
      />
      <PlateChip :plate-no="vehicle.plateNo" />
      <span class="tabular text-xs text-muted">{{ vehicle.code }}</span>
      <span v-if="reason(vehicle)" class="text-xs text-amber-700">{{ reason(vehicle) }}</span>
      <span class="tabular ml-auto text-xs">{{ formatKg(vehicle.capacityKg, locale as Locale) }}</span>
    </div>
  </div>
</template>
