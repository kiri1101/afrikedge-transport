<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import type { TransportOrderStatus, TransportOrderSummary } from '@/api/types'
import NewOrderDialog from '@/components/planning/NewOrderDialog.vue'
import TransportOrderCards from '@/components/planning/TransportOrderCards.vue'
import AsyncState from '@/components/ui/AsyncState.vue'
import LoadBar from '@/components/ui/LoadBar.vue'
import PlateChip from '@/components/ui/PlateChip.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import { useApiError } from '@/composables/useApiError'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useTransportOrdersStore } from '@/stores/transportOrders'
import { formatDate, fromIsoDate, toIsoDate } from '@/utils/dates'
import { loadLevel } from '@/utils/weights'

const { t } = useI18n()
const { errorMessage } = useApiError()
const { isMobile, isDesktop } = useBreakpoint()
const router = useRouter()
const store = useTransportOrdersStore()

const newOrderVisible = ref(false)

onMounted(() => void store.load())

const items = computed(() => store.result?.items ?? [])
const total = computed(() => store.result?.total ?? 0)
const errorText = computed(() => (store.error ? errorMessage(store.error) : null))
const filtered = computed(() => store.status !== null || store.deliveryDate !== null)

/** 'ALL' stands for "no status filter" in the segmented control. */
const statusOptions = computed(() => [
  { label: t('transportOrders.filters.all'), value: 'ALL' },
  ...(['DRAFT', 'VALIDATED', 'DEPARTED'] as const).map((value) => ({
    label: t(`status.transportOrder.${value}`),
    value,
  })),
])

const dateFilter = computed(() => (store.deliveryDate ? fromIsoDate(store.deliveryDate) : null))

function changeStatus(value: TransportOrderStatus | 'ALL'): void {
  void store.setStatus(value === 'ALL' ? null : value)
}

function changeDate(value: Date | Date[] | (Date | null)[] | null | undefined): void {
  void store.setDeliveryDate(value instanceof Date ? toIsoDate(value) : null)
}

const percent = (order: TransportOrderSummary) => Math.round((order.totalWeightKg / order.capacityKg) * 100)
const segments = (order: TransportOrderSummary) =>
  order.totalWeightKg > 0 ? [{ key: order.no, label: order.no, kg: order.totalWeightKg }] : []

const open = (no: string) => router.push(`/transport-orders/${no}`)
const onRowClick = (event: DataTableRowClickEvent) => open((event.data as TransportOrderSummary).no)
const onPage = (event: DataTablePageEvent) => store.setPage(event.page + 1, event.rows)
</script>

<template>
  <section>
    <header class="mb-4 flex items-end gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">{{ t('transportOrders.title') }}</h1>
        <p v-if="store.result" class="text-sm text-muted">{{ t('transportOrders.count', { total }, total) }}</p>
      </div>
      <Button
        class="ml-auto"
        icon="pi pi-plus"
        :label="isMobile ? undefined : t('transportOrders.new')"
        :aria-label="t('transportOrders.new')"
        @click="newOrderVisible = true"
      />
    </header>

    <div class="rounded-xl border border-line bg-white">
      <div class="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
        <div class="max-w-full overflow-x-auto [scrollbar-width:none]">
          <SelectButton
            :model-value="store.status ?? 'ALL'"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :aria-label="t('transportOrders.filters.status')"
            @update:model-value="changeStatus"
          />
        </div>
        <DatePicker
          :model-value="dateFilter"
          date-format="dd/mm/yy"
          show-icon
          show-button-bar
          :placeholder="t('transportOrders.filters.date')"
          :aria-label="t('transportOrders.filters.date')"
          class="w-full sm:w-52"
          @update:model-value="changeDate"
        />
      </div>

      <AsyncState
        :loading="store.loading && !store.result"
        :error="errorText"
        :empty="items.length === 0"
        :empty-text="filtered ? t('transportOrders.emptyFiltered') : t('transportOrders.empty')"
        :empty-action-label="filtered ? t('transportOrders.clearFilters') : undefined"
        @retry="store.load()"
        @empty-action="store.clearFilters()"
      >
        <div v-if="isMobile" class="p-3">
          <TransportOrderCards :items="items" />
        </div>

        <DataTable
          v-else
          :value="items"
          data-key="no"
          lazy
          paginator
          :rows="store.pageSize"
          :rows-per-page-options="[10, 20, 50]"
          :first="(store.page - 1) * store.pageSize"
          :total-records="total"
          :loading="store.loading"
          row-hover
          :pt="{ bodyRow: { class: 'cursor-pointer' } }"
          @row-click="onRowClick"
          @page="onPage"
        >
          <Column :header="t('transportOrders.columns.no')">
            <template #body="{ data }">
              <RouterLink :to="`/transport-orders/${data.no}`" class="tabular font-semibold hover:underline" @click.stop>
                {{ data.no }}
              </RouterLink>
            </template>
          </Column>
          <Column :header="t('transportOrders.columns.status')">
            <template #body="{ data }"><StatusTag :status="data.status" /></template>
          </Column>
          <Column :header="t('transportOrders.columns.date')">
            <template #body="{ data }"><span class="tabular">{{ formatDate(data.deliveryDate) }}</span></template>
          </Column>
          <Column :header="t('transportOrders.columns.vehicle')">
            <template #body="{ data }">
              <PlateChip :plate-no="data.plateNo" />
              <span class="tabular ml-1.5 text-xs text-muted">{{ data.vehicleCode }}</span>
            </template>
          </Column>
          <Column v-if="isDesktop" :header="t('transportOrders.columns.lines')" body-class="text-right tabular">
            <template #body="{ data }">{{ data.lineCount }}</template>
          </Column>
          <Column :header="t('transportOrders.columns.load')">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <LoadBar class="w-28" size="sm" :segments="segments(data)" :capacity-kg="data.capacityKg" />
                <span
                  class="tabular w-10 text-right text-xs"
                  :class="loadLevel(data.totalWeightKg, data.capacityKg) === 'ok' ? '' : 'text-amber-700'"
                  >{{ percent(data) }} %</span
                >
              </div>
            </template>
          </Column>
          <Column v-if="isDesktop" field="createdBy" :header="t('transportOrders.columns.createdBy')" />
        </DataTable>
      </AsyncState>
    </div>

    <NewOrderDialog v-model:visible="newOrderVisible" @created="open" />
  </section>
</template>
