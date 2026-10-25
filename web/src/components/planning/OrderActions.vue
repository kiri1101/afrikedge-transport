<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Role, TransportOrderDetail } from '@/api/types'

/**
 * Buttons come only from the API's allowedActions; when an expected one is missing,
 * a hint says why instead of leaving the user guessing.
 */
const props = defineProps<{ order: TransportOrderDetail; role: Role; compact?: boolean; busy?: boolean }>()
defineEmits<{ addLines: []; validate: []; depart: [] }>()

const { t } = useI18n()
const can = (action: TransportOrderDetail['allowedActions'][number]) => props.order.allowedActions.includes(action)

const hint = computed(() => {
  const { status, lineCount } = props.order
  if (status === 'DRAFT' && !can('VALIDATE')) {
    return props.role === 'DISPATCHER' ? t('detail.validateReserved') : lineCount === 0 ? t('detail.validateNeedsLines') : null
  }
  if (status === 'VALIDATED') return t('detail.locked')
  if (status === 'DEPARTED') return t('detail.readOnly')
  return null
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <Message v-if="hint" severity="info" :closable="false" size="small">{{ hint }}</Message>
    <Button
      v-if="can('VALIDATE')"
      icon="pi pi-check"
      :label="t('detail.validate')"
      :loading="busy"
      :disabled="busy"
      :class="{ 'w-full': compact }"
      @click="$emit('validate')"
    />
    <Button
      v-if="can('DEPART')"
      icon="pi pi-truck"
      :label="t('detail.depart')"
      :loading="busy"
      :disabled="busy"
      :class="{ 'w-full': compact }"
      @click="$emit('depart')"
    />
    <Button
      v-if="can('ADD_LINES') && !compact"
      icon="pi pi-plus"
      severity="secondary"
      :label="t('detail.addLines')"
      :disabled="busy"
      @click="$emit('addLines')"
    />
  </div>
</template>
