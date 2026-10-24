<script setup lang="ts">
import DatePicker from 'primevue/datepicker'
import { useI18n } from 'vue-i18n'
import { fromIsoDate, toIsoDate, todayIso } from '@/utils/dates'

/** Delivery date as YYYY-MM-DD, today at the earliest (R1). */
defineProps<{ modelValue: string; inputId: string }>()
const emit = defineEmits<{ 'update:modelValue': [iso: string] }>()

const { t } = useI18n()

function change(value: Date | Date[] | (Date | null)[] | null | undefined): void {
  // toIsoDate reads the local calendar day; toISOString() would shift it to UTC.
  if (value instanceof Date) emit('update:modelValue', toIsoDate(value))
}
</script>

<template>
  <div>
    <label class="mb-1 block text-sm font-semibold" :for="inputId">{{ t('dialog.date') }}</label>
    <DatePicker
      :input-id="inputId"
      :model-value="fromIsoDate(modelValue)"
      :min-date="fromIsoDate(todayIso())"
      date-format="dd/mm/yy"
      show-icon
      fluid
      @update:model-value="change"
    />
    <small class="block text-muted">{{ t('dialog.dateHint') }}</small>
  </div>
</template>
