<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import type { SalesOrder } from '@/api/types'
import AddToTransportDialog from '@/components/planning/AddToTransportDialog.vue'
import SalesOrderCards from '@/components/planning/SalesOrderCards.vue'
import SelectionBar from '@/components/planning/SelectionBar.vue'
import AsyncState from '@/components/ui/AsyncState.vue'
import MobilePager from '@/components/ui/MobilePager.vue'
import { useApiError } from '@/composables/useApiError'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useSalesOrdersStore } from '@/stores/salesOrders'
import { formatKg, type Locale } from '@/utils/weights'

const { t, locale } = useI18n()
const { errorMessage } = useApiError()
const { isMobile, isDesktop } = useBreakpoint()
const store = useSalesOrdersStore()

const route = useRoute()
const toast = useToast()
const dialogVisible = ref(false)
/** Set when coming from an order's "Add orders" button: the dialog preselects it. */
const targetNo = computed(() => (typeof route.query.target === 'string' ? route.query.target : undefined))

function onAdded(no: string): void {
  const n = store.selection.length
  toast.add({ group: 'added', severity: 'success', summary: t('dialog.success', { n, no }, n), detail: no, life: 6000 })
  store.clearSelection()
  void store.load()
  void store.loadCities()
}

onMounted(() => {
  void store.load()
  void store.loadCities()
})

const items = computed(() => store.result?.items ?? [])
const total = computed(() => store.result?.total ?? 0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / store.pageSize)))
const errorText = computed(() => (store.error ? errorMessage(store.error) : null))
const allOnPageSelected = computed(
  () => items.value.length > 0 && items.value.every((order) => store.isSelected(order.no)),
)
const kg = (value: number) => formatKg(value, locale.value as Locale)

const onPage = (event: DataTablePageEvent) => store.setPage(event.page + 1, event.rows)
const rowClass = (order: SalesOrder) => (store.isSelected(order.no) ? '!bg-teal-50' : '')
</script>

<template>
  <section>
    <Message v-if="targetNo" severity="info" :closable="false" class="mb-3">{{ t('salesOrders.targetHint', { no: targetNo }) }}</Message>

    <header class="mb-4">
      <h1 class="text-xl font-bold tracking-tight">{{ t('salesOrders.title') }}</h1>
      <p v-if="store.result" class="text-sm text-muted">
        {{
          store.city
            ? t('salesOrders.subtitleCity', { total, city: store.city }, total)
            : t('salesOrders.subtitle', { total }, total)
        }}
      </p>
    </header>

    <div class="rounded-xl border border-line bg-white">
      <div class="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
        <Select
          :model-value="store.city"
          :options="store.cities"
          :placeholder="t('salesOrders.allCities')"
          :aria-label="t('salesOrders.cityFilter')"
          show-clear
          class="w-full sm:w-60"
          @update:model-value="store.setCity($event ?? null)"
        />
      </div>

      <AsyncState
        :loading="store.loading && !store.result"
        :error="errorText"
        :empty="items.length === 0"
        :empty-text="store.city ? t('salesOrders.emptyCity', { city: store.city }) : t('salesOrders.empty')"
        :empty-action-label="store.city ? t('salesOrders.allCities') : undefined"
        @retry="store.load()"
        @empty-action="store.setCity(null)"
      >
        <div v-if="isMobile" class="p-3">
          <SalesOrderCards :items="items" :is-selected="store.isSelected" @toggle="store.toggle" />
          <MobilePager :page="store.page" :pages="pages" @change="store.setPage($event, store.pageSize)" />
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
          :row-class="rowClass"
          @page="onPage"
        >
          <Column header-style="width: 3rem">
            <template #header>
              <Checkbox
                :model-value="allOnPageSelected"
                binary
                :aria-label="t('salesOrders.selectPage')"
                @update:model-value="store.togglePage($event)"
              />
            </template>
            <template #body="{ data }">
              <Checkbox
                :model-value="store.isSelected(data.no)"
                binary
                :aria-label="t('salesOrders.select', { no: data.no })"
                @update:model-value="store.toggle(data)"
              />
            </template>
          </Column>
          <Column field="no" :header="t('salesOrders.columns.no')">
            <template #body="{ data }"><span class="tabular font-medium">{{ data.no }}</span></template>
          </Column>
          <Column :header="t('salesOrders.columns.customer')">
            <template #body="{ data }">
              <span class="block">{{ data.customerName }}</span>
              <small class="tabular text-muted">
                {{ data.customerNo }}<template v-if="!isDesktop"> · {{ data.deliveryCity }}</template>
              </small>
            </template>
          </Column>
          <Column v-if="isDesktop" field="deliveryCity" :header="t('salesOrders.columns.city')" />
          <Column :header="t('salesOrders.columns.weight')" header-class="[&>div]:justify-end" body-class="text-right">
            <template #body="{ data }"><span class="tabular">{{ kg(data.totalWeightKg) }}</span></template>
          </Column>
        </DataTable>
      </AsyncState>
    </div>

    <SelectionBar
      v-if="store.selection.length > 0"
      :count="store.selection.length"
      :weight-kg="store.selectedWeightKg"
      @clear="store.clearSelection()"
      @add="dialogVisible = true"
    />

    <AddToTransportDialog
      v-model:visible="dialogVisible"
      :selection="store.selection"
      :target-no="targetNo"
      @done="onAdded"
    />

    <Toast group="added" position="top-right">
      <template #message="{ message }">
        <div class="flex flex-1 items-start gap-2">
          <i class="pi pi-check-circle mt-0.5 text-emerald-600" aria-hidden="true" />
          <div>
            <p class="font-semibold">{{ message.summary }}</p>
            <RouterLink :to="`/transport-orders/${message.detail}`" class="text-sm font-semibold text-teal-700 underline">
              {{ t('dialog.open') }}
            </RouterLink>
          </div>
        </div>
      </template>
    </Toast>
  </section>
</template>
