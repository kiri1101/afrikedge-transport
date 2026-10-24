<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TransportOrderStatus } from '@/api/types'

const props = defineProps<{
  status: TransportOrderStatus
  createdBy: string
  validatedBy: string | null
  compact?: boolean
}>()
const { t } = useI18n()

const STEPS: TransportOrderStatus[] = ['DRAFT', 'VALIDATED', 'DEPARTED']
const current = computed(() => STEPS.indexOf(props.status))

const who = (step: TransportOrderStatus) =>
  step === 'DRAFT' ? props.createdBy : step === 'VALIDATED' ? props.validatedBy : null
</script>

<template>
  <ol class="flex items-center" :aria-label="t('detail.lifecycle')">
    <li v-for="(step, index) in STEPS" :key="step" class="flex items-center" :aria-current="index === current ? 'step' : undefined">
      <span v-if="index > 0" class="mx-2 h-0.5" :class="[compact ? 'w-4' : 'w-8', index <= current ? 'bg-teal-700' : 'bg-slate-300']" />
      <span class="flex items-center gap-2 text-xs" :class="index === current ? 'font-semibold text-slate-900' : 'text-muted'">
        <span
          class="grid place-items-center rounded-full border-2 font-bold"
          :class="[
            compact ? 'size-3' : 'size-6 text-[11px]',
            index < current ? 'border-teal-700 bg-teal-700 text-white' : '',
            index === current ? 'border-teal-700 text-teal-700 ring-4 ring-teal-50' : '',
            index > current ? 'border-slate-300 bg-white text-slate-400' : '',
          ]"
          aria-hidden="true"
        >
          <template v-if="!compact">
            <i v-if="index < current" class="pi pi-check text-[10px]" />
            <template v-else>{{ index + 1 }}</template>
          </template>
        </span>
        <span :class="{ 'sr-only': compact }">
          {{ t(`status.transportOrder.${step}`) }}
          <small v-if="!compact && who(step) && index <= current" class="block font-normal text-muted">
            {{ t('detail.by', { user: who(step) }) }}
          </small>
        </span>
      </span>
    </li>
  </ol>
</template>
