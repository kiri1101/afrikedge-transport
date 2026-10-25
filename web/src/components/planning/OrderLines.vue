<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import { useI18n } from 'vue-i18n'
import type { SalesOrder } from '@/api/types'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { formatKg, type Locale } from '@/utils/weights'

defineProps<{ lines: SalesOrder[]; canRemove: boolean; busy?: boolean }>()
defineEmits<{ remove: [salesOrderNo: string] }>()

const { t, locale } = useI18n()
const { isMobile } = useBreakpoint()
const kg = (value: number) => formatKg(value, locale.value as Locale)
</script>

<template>
  <p v-if="lines.length === 0" class="px-4 py-6 text-center text-sm text-muted">{{ t('detail.noLines') }}</p>

  <ul v-else-if="isMobile" class="space-y-2 p-3">
    <li v-for="line in lines" :key="line.no" class="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
      <div class="min-w-0 flex-1">
        <span class="tabular block font-semibold">{{ line.no }}</span>
        <span class="block truncate text-xs text-muted">{{ line.customerName }} · {{ line.deliveryCity }}</span>
      </div>
      <span class="tabular text-sm">{{ kg(line.totalWeightKg) }}</span>
      <Button
        v-if="canRemove"
        icon="pi pi-times"
        severity="danger"
        outlined
        rounded
        class="!size-11"
        :disabled="busy"
        :aria-label="t('detail.removeOrder', { no: line.no })"
        @click="$emit('remove', line.no)"
      />
    </li>
  </ul>

  <DataTable v-else :value="lines" data-key="no">
    <Column :header="t('salesOrders.columns.no')">
      <template #body="{ data }"><span class="tabular font-medium">{{ data.no }}</span></template>
    </Column>
    <Column :header="t('salesOrders.columns.customer')">
      <template #body="{ data }">
        <span class="block">{{ data.customerName }}</span>
        <small class="text-muted">{{ data.deliveryCity }}</small>
      </template>
    </Column>
    <Column :header="t('salesOrders.columns.weight')" header-class="[&>div]:justify-end" body-class="text-right">
      <template #body="{ data }"><span class="tabular">{{ kg(data.totalWeightKg) }}</span></template>
    </Column>
    <Column v-if="canRemove" body-class="text-right" header-style="width: 7rem">
      <template #body="{ data }">
        <Button
          size="small"
          severity="danger"
          outlined
          :label="t('detail.remove')"
          :disabled="busy"
          :aria-label="t('detail.removeOrder', { no: data.no })"
          @click="$emit('remove', data.no)"
        />
      </template>
    </Column>
  </DataTable>
</template>
