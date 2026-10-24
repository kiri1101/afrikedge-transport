<script setup lang="ts">
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'
import { APP_USERS, useUserStore } from '@/stores/user'

/** On mobile the language switch lives in this menu, since the header has no room for it. */
const props = defineProps<{ compact?: boolean }>()

const { t, locale } = useI18n()
const user = useUserStore()
const menu = useTemplateRef<InstanceType<typeof Menu>>('menu')

const items = computed<MenuItem[]>(() => [
  {
    label: t('user.switch'),
    items: APP_USERS.map((u) => ({
      label: u.id,
      role: u.role,
      current: u.id === user.userId,
      command: () => user.switchTo(u.id),
    })),
  },
  ...(props.compact
    ? [
        {
          label: t('lang.label'),
          items: (['fr', 'en'] as const).map((code) => ({
            label: t(`lang.${code}`),
            current: locale.value === code,
            command: () => setLocale(code),
          })),
        },
      ]
    : []),
])
</script>

<template>
  <div>
    <button
      type="button"
      class="flex items-center gap-2 rounded-full border border-ink-line bg-ink-2 py-1 pl-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
      :class="compact ? 'pr-1' : 'pr-3'"
      aria-haspopup="menu"
      :aria-label="`${t('user.current')} : ${user.userId}. ${t('user.switch')}`"
      @click="menu?.toggle($event)"
    >
      <span
        class="grid size-8 place-items-center rounded-full text-sm font-bold text-ink"
        :class="user.userId === 'eric' ? 'bg-indigo-300' : 'bg-amber-300'"
        aria-hidden="true"
        >{{ user.userId[0]!.toUpperCase() }}</span
      >
      <span v-if="!compact" class="leading-tight">
        <span class="block text-sm font-semibold text-white">{{ user.userId }}</span>
        <span class="block text-[10px] font-semibold tracking-wide text-amber-300 uppercase">{{ t(`roles.${user.role}`) }}</span>
      </span>
      <i v-if="!compact" class="pi pi-chevron-down text-xs text-slate-400" aria-hidden="true" />
    </button>
    <Menu ref="menu" :model="items" popup>
      <template #item="{ item, props: itemProps }">
        <a v-bind="itemProps.action" class="flex items-center gap-2">
          <i class="pi w-4 text-teal-700" :class="item.current ? 'pi-check' : ''" aria-hidden="true" />
          <span class="font-medium">{{ item.label }}</span>
          <span v-if="item.role" class="text-xs text-muted">{{ t(`roles.${item.role}`) }}</span>
        </a>
      </template>
    </Menu>
  </div>
</template>
