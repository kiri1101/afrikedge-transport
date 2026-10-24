<script setup lang="ts">
import Message from 'primevue/message'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import OrderActions from '@/components/planning/OrderActions.vue'
import OrderLines from '@/components/planning/OrderLines.vue'
import AsyncState from '@/components/ui/AsyncState.vue'
import LifecycleStepper from '@/components/ui/LifecycleStepper.vue'
import LoadBar from '@/components/ui/LoadBar.vue'
import PlateChip from '@/components/ui/PlateChip.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import { useApiError } from '@/composables/useApiError'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useTransportOrdersStore } from '@/stores/transportOrders'
import { useUserStore } from '@/stores/user'
import { formatDate } from '@/utils/dates'
import { formatKg, formatNumber, loadLevel, type Locale } from '@/utils/weights'

const props = defineProps<{ no: string }>()

const { t, locale } = useI18n()
const { errorMessage } = useApiError()
const { isMobile, isDesktop } = useBreakpoint()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const store = useTransportOrdersStore()
const user = useUserStore()

onMounted(() => store.loadDetail(props.no))
watch(
  () => props.no,
  (no) => store.loadDetail(no),
)

const order = computed(() => (store.current?.no === props.no ? store.current : null))
const errorText = computed(() => (store.detailError ? errorMessage(store.detailError) : null))
const kg = (value: number) => formatKg(value, locale.value as Locale)
const percent = computed(() => (order.value ? Math.round((order.value.totalWeightKg / order.value.capacityKg) * 100) : 0))
const level = computed(() => (order.value ? loadLevel(order.value.totalWeightKg, order.value.capacityKg) : 'ok'))
const segments = computed(() =>
  (order.value?.lines ?? []).map((line) => ({
    key: line.no,
    label: `${line.no} · ${line.customerName} · ${kg(line.totalWeightKg)}`,
    kg: line.totalWeightKg,
  })),
)
const canRemove = computed(() => order.value?.allowedActions.includes('REMOVE_LINES') ?? false)

/** Asks first (spec: every irreversible or unwanted-delete risk is confirmed), then runs and reports. */
function confirmThen(options: { header: string; message: string; done: string; run: () => Promise<boolean> }): void {
  confirm.require({
    header: options.header,
    message: options.message,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: t('detail.confirm.accept') },
    rejectProps: { label: t('detail.confirm.reject'), severity: 'secondary', text: true },
    accept: async () => {
      try {
        if (await options.run()) {
          toast.add({ severity: 'success', summary: options.done, life: 4000 })
        }
      } catch (e) {
        toast.add({ severity: 'error', summary: errorMessage(e), life: 6000 })
      }
    },
  })
}

function removeLine(salesOrderNo: string): void {
  confirmThen({
    header: t('detail.confirm.removeTitle', { no: salesOrderNo }),
    message: t('detail.confirm.removeMessage', { no: salesOrderNo }),
    done: t('detail.done.removed', { no: salesOrderNo }),
    run: () => store.removeLine(salesOrderNo),
  })
}

function validate(): void {
  confirmThen({
    header: t('detail.confirm.validateTitle', { no: props.no }),
    message: t('detail.confirm.validateMessage'),
    done: t('detail.done.validated', { no: props.no }),
    run: () => store.validate(),
  })
}

function depart(): void {
  const n = order.value?.lineCount ?? 0
  confirmThen({
    header: t('detail.confirm.departTitle', { no: props.no }),
    message: t('detail.confirm.departMessage', { n }, n),
    done: t('detail.done.departed', { no: props.no }),
    run: () => store.depart(),
  })
}

const addLines = () => router.push({ path: '/sales-orders', query: { target: props.no } })
</script>

<template>
  <section>
    <RouterLink to="/transport-orders" class="mb-1 inline-flex items-center gap-1 text-sm text-muted hover:text-slate-900">
      <i class="pi pi-arrow-left text-xs" aria-hidden="true" /> {{ t('detail.back') }}
    </RouterLink>

    <AsyncState
      :loading="store.detailLoading && !order"
      :error="errorText"
      :empty="false"
      empty-text=""
      @retry="store.loadDetail(no)"
    >
      <template v-if="order">
        <header class="mb-4 flex flex-wrap items-center gap-3">
          <h1 class="tabular text-2xl font-bold">{{ order.no }}</h1>
          <StatusTag :status="order.status" />
          <LifecycleStepper
            class="sm:ml-auto"
            :status="order.status"
            :created-by="order.createdBy"
            :validated-by="order.validatedBy"
            :compact="isMobile"
          />
        </header>

        <Message v-if="store.staleNotice" severity="warn" class="mb-4" :closable="false">{{ t('detail.stale') }}</Message>

        <div :class="isDesktop ? 'grid grid-cols-[1fr_18rem] items-start gap-4' : 'space-y-4'">
          <div class="space-y-4">
            <!-- The load is the heart of the page: one segment per sales order. -->
            <section class="rounded-xl border border-line bg-white p-4" :aria-label="t('detail.load')">
              <div class="mb-3 flex flex-wrap items-baseline gap-2">
                <span class="tabular text-3xl font-bold tracking-tight">{{ formatNumber(order.totalWeightKg, locale as Locale) }}</span>
                <span class="tabular text-muted">/ {{ kg(order.capacityKg) }}</span>
                <span
                  class="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold"
                  :class="level === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'"
                >
                  {{ t('detail.free', { pct: percent, kg: kg(order.remainingKg) }) }}
                </span>
              </div>
              <LoadBar size="lg" :segments="segments" :capacity-kg="order.capacityKg" />
              <ul v-if="!isMobile && segments.length > 0" class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <li v-for="(segment, index) in segments" :key="segment.key" class="flex items-center gap-1.5">
                  <span
                    class="size-2.5 rounded-sm"
                    :class="level === 'ok' ? (index % 2 ? 'bg-load-alt' : 'bg-load') : index % 2 ? 'bg-warn-alt' : 'bg-warn'"
                    aria-hidden="true"
                  />
                  {{ segment.label }}
                </li>
              </ul>
            </section>

            <!-- On small screens the facts and actions come before the lines. -->
            <aside v-if="!isDesktop" class="grid gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-2">
              <div class="text-sm">
                <PlateChip :plate-no="order.plateNo" size="md" />
                <span class="tabular ml-1.5 text-xs text-muted">{{ order.vehicleCode }}</span>
                <p class="tabular mt-2 text-muted">
                  {{ formatDate(order.deliveryDate) }} · {{ order.createdBy }}<template v-if="order.validatedBy"> · {{ order.validatedBy }}</template>
                </p>
              </div>
              <OrderActions v-if="!isMobile" :order="order" :role="user.role" @add-lines="addLines" @validate="validate" @depart="depart" />
            </aside>

            <section class="overflow-hidden rounded-xl border border-line bg-white">
              <div class="flex items-center gap-2 border-b border-line-soft px-4 py-3">
                <h2 class="font-semibold">{{ t('detail.lines') }}</h2>
                <span class="text-muted">· {{ order.lineCount }}</span>
                <button
                  v-if="order.allowedActions.includes('ADD_LINES') && !isDesktop"
                  type="button"
                  class="ml-auto text-sm font-semibold text-teal-700"
                  @click="addLines"
                >
                  + {{ isMobile ? t('selection.addShort') : t('detail.addLines') }}
                </button>
              </div>
              <OrderLines :lines="order.lines" :can-remove="canRemove" @remove="removeLine" />
            </section>
          </div>

          <aside v-if="isDesktop" class="divide-y divide-line-soft rounded-xl border border-line bg-white">
            <div class="p-4">
              <h2 class="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{{ t('detail.vehicle') }}</h2>
              <PlateChip :plate-no="order.plateNo" size="md" />
              <span class="tabular ml-1.5 text-xs text-muted">{{ order.vehicleCode }}</span>
              <dl class="mt-2 flex justify-between text-sm">
                <dt class="text-muted">{{ t('detail.capacity') }}</dt>
                <dd class="tabular">{{ kg(order.capacityKg) }}</dd>
              </dl>
            </div>
            <dl class="space-y-1 p-4 text-sm">
              <div class="flex justify-between"><dt class="text-muted">{{ t('detail.date') }}</dt><dd class="tabular">{{ formatDate(order.deliveryDate) }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">{{ t('detail.createdBy') }}</dt><dd>{{ order.createdBy }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">{{ t('detail.validatedBy') }}</dt><dd>{{ order.validatedBy ?? '—' }}</dd></div>
            </dl>
            <div class="p-4">
              <h2 class="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{{ t('detail.actions') }}</h2>
              <OrderActions :order="order" :role="user.role" @add-lines="addLines" @validate="validate" @depart="depart" />
            </div>
          </aside>
        </div>

        <!-- Mobile: the main action stays under the thumb. -->
        <div v-if="isMobile" class="fixed inset-x-0 bottom-16 z-10 border-t border-line bg-white p-3">
          <OrderActions compact :order="order" :role="user.role" @add-lines="addLines" @validate="validate" @depart="depart" />
        </div>
      </template>
    </AsyncState>
  </section>
</template>
