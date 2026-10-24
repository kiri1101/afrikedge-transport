<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
const { isMobile } = useBreakpoint()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6" :class="{ 'pb-40': isMobile }">
      <!-- Keyed on the user: switching remounts the screen, so data and allowed actions reload. -->
      <RouterView :key="user.userId" />
    </main>
    <BottomNav v-if="isMobile" />
    <Toast position="top-right" />
    <ConfirmDialog />
  </div>
</template>
