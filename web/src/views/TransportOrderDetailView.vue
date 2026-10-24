<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section>
    <h1 class="text-xl font-bold">{{ t('nav.transportOrders') }}</h1>
    <p class="text-muted">{{ t('common.comingSoon') }}</p>
  </section>
</template>
