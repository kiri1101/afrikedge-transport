<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createTransportOrder } from '@/api/transportOrders'
import { useApiError } from '@/composables/useApiError'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useVehicleAvailability } from '@/composables/useVehicleAvailability'
import DeliveryDateField from './DeliveryDateField.vue'
import VehiclePicker from './VehiclePicker.vue'

/** Creates an empty Draft order (vehicle + date); the caller opens it. */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; created: [no: string] }>()

const { t } = useI18n()
const { errorMessage } = useApiError()
const { isMobile } = useBreakpoint()
const { vehicles, booked, deliveryDate, reset, setDate } = useVehicleAvailability()

const vehicleCode = ref<string | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    vehicleCode.value = null
    error.value = null
    try {
      await reset()
    } catch (e) {
      error.value = errorMessage(e)
    }
  },
  { immediate: true },
)

async function changeDate(iso: string): Promise<void> {
  try {
    await setDate(iso)
    if (vehicleCode.value && booked.value[vehicleCode.value]) vehicleCode.value = null
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function submit(): Promise<void> {
  pending.value = true
  error.value = null
  try {
    const created = await createTransportOrder({ vehicleCode: vehicleCode.value!, deliveryDate: deliveryDate.value })
    emit('created', created.no)
    emit('update:visible', false)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :closable="!pending"
    :header="t('newOrder.title')"
    :breakpoints="{ '639px': '100vw' }"
    :style="{ width: '32rem' }"
    :pt="{ root: { class: isMobile ? '!max-h-dvh !h-dvh !rounded-none !m-0' : '' } }"
    @update:visible="emit('update:visible', $event)"
  >
    <Message v-if="error" severity="error" :closable="false" class="mb-3">{{ error }}</Message>
    <DeliveryDateField class="mb-3" input-id="new-order-date" :model-value="deliveryDate" @update:model-value="changeDate" />
    <p class="mb-1 text-sm font-semibold">
      {{ t('dialog.vehicle') }} <span class="font-normal text-muted">· {{ t('dialog.vehicleHint') }}</span>
    </p>
    <VehiclePicker v-model="vehicleCode" :vehicles="vehicles" :booked="booked" :min-capacity-kg="0" />

    <template #footer>
      <Button
        v-if="!isMobile"
        :label="t('dialog.cancel')"
        severity="secondary"
        text
        :disabled="pending"
        @click="emit('update:visible', false)"
      />
      <Button
        :class="{ 'w-full': isMobile }"
        :label="t('newOrder.submit')"
        :loading="pending"
        :disabled="pending || !vehicleCode"
        @click="submit"
      />
    </template>
  </Dialog>
</template>
