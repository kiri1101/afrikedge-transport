<script setup lang="ts">
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '@/api/http'
import { addLines, createTransportOrder, fetchTransportOrders } from '@/api/transportOrders'
import type { SalesOrder, TransportOrderSummary, Vehicle } from '@/api/types'
import { fetchVehicles } from '@/api/vehicles'
import { useApiError } from '@/composables/useApiError'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { fromIsoDate, toIsoDate, todayIso } from '@/utils/dates'
import { fitsIn, formatKg, toHundredths, type Locale } from '@/utils/weights'
import DraftOrderOption from './DraftOrderOption.vue'
import VehiclePicker from './VehiclePicker.vue'

const props = defineProps<{ visible: boolean; selection: SalesOrder[]; targetNo?: string }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; done: [no: string] }>()

const { t, locale } = useI18n()
const { errorMessage } = useApiError()
const { isMobile, isDesktop } = useBreakpoint()

type Mode = 'existing' | 'new'
const mode = ref<Mode>('existing')
const drafts = ref<TransportOrderSummary[]>([])
const vehicles = ref<Vehicle[]>([])
const booked = ref<Record<string, string>>({})
const draftNo = ref<string | null>(null)
const vehicleCode = ref<string | null>(null)
const deliveryDate = ref<string>(todayIso())
const pending = ref(false)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

const addKg = computed(() => props.selection.reduce((sum, o) => sum + toHundredths(o.totalWeightKg), 0) / 100)
const salesOrderNos = computed(() => props.selection.map((o) => o.no))
const chosenDraft = computed(() => drafts.value.find((d) => d.no === draftNo.value) ?? null)
const canSubmit = computed(() =>
  mode.value === 'existing' ? chosenDraft.value !== null : vehicleCode.value !== null && deliveryDate.value !== '',
)
const modeOptions = computed(() => [
  { label: t('dialog.existingShort'), value: 'existing' },
  { label: t('dialog.newShort'), value: 'new' },
])

async function loadDrafts(): Promise<void> {
  const page = await fetchTransportOrders({ status: 'DRAFT', deliveryDate: null, page: 1, pageSize: 100 })
  drafts.value = page.items
  const target = drafts.value.find((d) => d.no === props.targetNo)
  const firstFitting = drafts.value.find((d) => fitsIn(d.totalWeightKg, d.capacityKg, addKg.value))
  if (!chosenDraft.value) draftNo.value = (target ?? firstFitting)?.no ?? null
}

async function loadBooked(): Promise<void> {
  const page = await fetchTransportOrders({ status: null, deliveryDate: deliveryDate.value, page: 1, pageSize: 100 })
  booked.value = Object.fromEntries(page.items.map((o) => [o.vehicleCode, o.no]))
  if (vehicleCode.value && booked.value[vehicleCode.value]) vehicleCode.value = null
}

async function open(): Promise<void> {
  error.value = null
  notice.value = null
  mode.value = 'existing'
  draftNo.value = null
  vehicleCode.value = null
  deliveryDate.value = todayIso()
  try {
    const [, list] = await Promise.all([loadDrafts(), fetchVehicles(), loadBooked()])
    vehicles.value = list
  } catch (e) {
    error.value = errorMessage(e)
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) void open()
  },
  { immediate: true },
)

function chooseDraft(no: string): void {
  draftNo.value = no
  vehicleCode.value = null
  mode.value = 'existing'
}

function chooseVehicle(code: string): void {
  vehicleCode.value = code
  draftNo.value = null
  mode.value = 'new'
}

async function changeDate(value: Date | Date[] | (Date | null)[] | null | undefined): Promise<void> {
  if (!(value instanceof Date)) return
  deliveryDate.value = toIsoDate(value)
  try {
    await loadBooked()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function submit(): Promise<void> {
  pending.value = true
  error.value = null
  notice.value = null
  try {
    const no = mode.value === 'existing' ? await addToDraft() : await addToNewOrder()
    if (no) {
      emit('done', no)
      emit('update:visible', false)
    }
  } finally {
    pending.value = false
  }
}

async function addToDraft(): Promise<string | null> {
  const draft = chosenDraft.value!
  try {
    return (await addLines(draft.no, draft.version, salesOrderNos.value)).no
  } catch (e) {
    if (e instanceof ApiError && e.status === 412) {
      // Someone changed that order since the list was loaded: refresh the gauges, keep the selection.
      await loadDrafts()
      notice.value = t('dialog.stale', { no: draft.no })
    } else {
      error.value = errorMessage(e)
    }
    return null
  }
}

async function addToNewOrder(): Promise<string | null> {
  let created
  try {
    created = await createTransportOrder({ vehicleCode: vehicleCode.value!, deliveryDate: deliveryDate.value })
  } catch (e) {
    error.value = errorMessage(e)
    return null
  }
  try {
    return (await addLines(created.no, created.version, salesOrderNos.value)).no
  } catch (e) {
    // The empty order exists now: say so, and offer it in the draft list.
    error.value = t('dialog.createdButNotFilled', { no: created.no, reason: errorMessage(e) })
    await loadDrafts()
    await loadBooked()
    draftNo.value = null
    return null
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="!pending"
    :closable="!pending"
    :breakpoints="{ '1023px': '90vw', '639px': '100vw' }"
    :style="{ width: '64rem' }"
    :pt="{ root: { class: isMobile ? '!max-h-dvh !h-dvh !rounded-none !m-0' : '' } }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <div class="flex items-baseline gap-3">
        <h2 class="text-lg font-bold">{{ t('dialog.title', { n: selection.length }, selection.length) }}</h2>
        <span class="tabular font-semibold text-teal-700">{{ formatKg(addKg, locale as Locale) }}</span>
      </div>
    </template>

    <SelectButton
      v-if="isMobile"
      v-model="mode"
      :options="modeOptions"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      class="mb-3 w-full"
    />

    <Message v-if="error" severity="error" :closable="false" class="mb-3">{{ error }}</Message>
    <Message v-if="notice" severity="warn" :closable="false" class="mb-3">{{ notice }}</Message>

    <div :class="isDesktop ? 'grid grid-cols-2 gap-5' : 'space-y-5'">
      <section v-if="!isMobile || mode === 'existing'">
        <h3 v-if="!isMobile" class="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
          {{ t('dialog.existing') }}
        </h3>
        <p v-if="drafts.length === 0" class="text-sm text-muted">{{ t('dialog.noDrafts') }}</p>
        <div role="radiogroup" class="space-y-2">
          <DraftOrderOption
            v-for="draft in drafts"
            :key="draft.no"
            :order="draft"
            :add-kg="addKg"
            :selected="mode === 'existing' && draftNo === draft.no"
            @select="chooseDraft(draft.no)"
          />
        </div>
      </section>

      <section v-if="!isMobile || mode === 'new'" :class="{ 'border-l border-line pl-5': isDesktop }">
        <h3 v-if="!isMobile" class="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
          {{ t('dialog.new') }}
        </h3>
        <label class="mb-1 block text-sm font-semibold" for="delivery-date">{{ t('dialog.date') }}</label>
        <DatePicker
          input-id="delivery-date"
          :model-value="fromIsoDate(deliveryDate)"
          :min-date="fromIsoDate(todayIso())"
          date-format="dd/mm/yy"
          show-icon
          fluid
          @update:model-value="changeDate"
        />
        <small class="mb-3 block text-muted">{{ t('dialog.dateHint') }}</small>
        <p class="mb-1 text-sm font-semibold">
          {{ t('dialog.vehicle') }} <span class="font-normal text-muted">· {{ t('dialog.vehicleHint') }}</span>
        </p>
        <VehiclePicker
          :vehicles="vehicles"
          :booked="booked"
          :min-capacity-kg="addKg"
          :model-value="mode === 'new' ? vehicleCode : null"
          @update:model-value="chooseVehicle"
        />
      </section>
    </div>

    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <small v-if="!isMobile" class="mr-auto text-muted">{{ t('dialog.apiRechecks') }}</small>
        <Button
          v-if="!isMobile"
          :label="t('dialog.cancel')"
          severity="secondary"
          text
          :disabled="pending"
          @click="emit('update:visible', false)"
        />
        <Button
          data-testid="submit"
          :class="{ 'w-full': isMobile }"
          :label="mode === 'existing' && chosenDraft ? t('dialog.submitExisting', { no: chosenDraft.no }) : t('dialog.submitNew')"
          :loading="pending"
          :disabled="pending || !canSubmit"
          @click="submit"
        />
      </div>
    </template>
  </Dialog>
</template>
