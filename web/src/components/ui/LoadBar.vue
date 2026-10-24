<script setup lang="ts">
import { computed } from 'vue'
import { loadLevel, toHundredths } from '@/utils/weights'

export type LoadSegment = { key: string; label: string; kg: number }

const props = withDefaults(
  defineProps<{
    segments: LoadSegment[]
    capacityKg: number
    /** Weight that would be added (dialog preview): hatched if it fits, red if it overflows. */
    projectedKg?: number
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
  }>(),
  { projectedKg: 0, size: 'md', ariaLabel: undefined },
)

const usedKg = computed(() => props.segments.reduce((sum, s) => sum + toHundredths(s.kg), 0) / 100)
const totalKg = computed(() => (toHundredths(usedKg.value) + toHundredths(props.projectedKg)) / 100)
const level = computed(() => loadLevel(totalKg.value, props.capacityKg))
const roomKg = computed(() => Math.max(0, props.capacityKg - usedKg.value))
const overflows = computed(() => props.projectedKg > 0 && level.value === 'over')

/** Percentage of capacity, two decimals; the bar itself clips anything past 100 %. */
const width = (kg: number) => `${props.capacityKg > 0 ? ((kg / props.capacityKg) * 100).toFixed(2) : '0.00'}%`

// Full class names: Tailwind only generates classes it can read whole in the source.
const TONES = { load: ['bg-load', 'bg-load-alt'], warn: ['bg-warn', 'bg-warn-alt'] }
const segmentColor = (index: number) =>
  TONES[level.value === 'ok' || overflows.value ? 'load' : 'warn'][index % 2]

const heights = { sm: 'h-2', md: 'h-3', lg: 'h-5' }
</script>

<template>
  <div
    role="meter"
    :aria-valuemin="0"
    :aria-valuemax="capacityKg"
    :aria-valuenow="totalKg"
    :aria-label="ariaLabel ?? `${totalKg} / ${capacityKg} kg`"
    :data-level="level"
    class="flex overflow-hidden rounded-md bg-[repeating-linear-gradient(-45deg,#eef1f5_0_5px,#e2e7ee_5px_10px)]"
    :class="heights[size]"
  >
    <span
      v-for="(segment, index) in segments"
      :key="segment.key"
      data-segment
      class="h-full shrink-0 border-r-2 border-white last:border-r-0"
      :class="segmentColor(index)"
      :style="{ width: width(segment.kg) }"
      :title="segment.label"
    />
    <span
      v-if="projectedKg > 0 && !overflows"
      data-projected
      class="h-full shrink-0 bg-[repeating-linear-gradient(45deg,var(--color-projected)_0_5px,#99f6e4_5px_10px)]"
      :style="{ width: width(projectedKg) }"
    />
    <span
      v-if="overflows"
      data-over
      class="h-full shrink-0 bg-[repeating-linear-gradient(45deg,var(--color-over)_0_5px,#fecaca_5px_10px)]"
      :style="{ width: width(roomKg) }"
    />
  </div>
</template>
