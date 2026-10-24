<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    loading: boolean
    error: string | null
    empty: boolean
    emptyText: string
    emptyActionLabel?: string
    /** Skeleton rows shown while loading. */
    rows?: number
  }>(),
  { emptyActionLabel: undefined, rows: 5 },
)
defineEmits<{ retry: []; emptyAction: [] }>()

const { t } = useI18n()
</script>

<template>
  <div>
    <div v-if="loading" role="status" class="space-y-3 p-4">
      <span class="sr-only">{{ t('common.loading') }}</span>
      <div
        v-for="row in rows"
        :key="row"
        class="h-3 rounded bg-slate-200 motion-safe:animate-pulse"
        :style="{ width: `${90 - (row % 3) * 12}%` }"
        aria-hidden="true"
      />
    </div>

    <div v-else-if="error" class="p-4">
      <Message severity="error" :closable="false">
        <div class="flex flex-wrap items-center gap-3">
          <span>{{ error }}</span>
          <Button size="small" severity="secondary" icon="pi pi-refresh" :label="t('common.retry')" @click="$emit('retry')" />
        </div>
      </Message>
    </div>

    <div v-else-if="empty" class="px-4 py-10 text-center text-muted">
      <i class="pi pi-inbox mb-2 text-3xl text-slate-400" aria-hidden="true" />
      <p class="font-semibold text-slate-900">{{ emptyText }}</p>
      <Button
        v-if="emptyActionLabel"
        class="mt-3"
        size="small"
        severity="secondary"
        :label="emptyActionLabel"
        @click="$emit('emptyAction')"
      />
    </div>

    <slot v-else />
  </div>
</template>
