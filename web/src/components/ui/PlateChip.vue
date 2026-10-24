<script setup lang="ts">
withDefaults(defineProps<{ plateNo: string; size?: 'sm' | 'md' }>(), { size: 'sm' })
</script>

<template>
  <!-- Licence-plate look: a thin green-red-yellow band, as on Cameroonian plates. -->
  <span
    class="inline-flex items-stretch overflow-hidden rounded border-[1.5px] border-slate-800 bg-white align-middle leading-none font-semibold tracking-wider whitespace-nowrap"
    :class="size === 'md' ? 'text-sm' : 'text-[11px]'"
  >
    <span class="w-1 bg-[linear-gradient(#007a5e_0_33.3%,#ce1126_33.3%_66.6%,#fcd116_66.6%)]" aria-hidden="true" />
    <span class="tabular px-1.5 py-[3px]">{{ plateNo }}</span>
  </span>
</template>
