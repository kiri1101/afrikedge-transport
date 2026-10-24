import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Role } from '@/api/types'

/** Display list for the switcher; the API stays the authority on permissions (allowedActions). */
export const APP_USERS = [
  { id: 'diane', role: 'DISPATCHER' },
  { id: 'eric', role: 'LOGISTICS_MANAGER' },
] as const satisfies readonly { id: string; role: Role }[]

export type AppUserId = (typeof APP_USERS)[number]['id']

const STORAGE_KEY = 'tp.user'

function readSaved(): AppUserId {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'eric' ? 'eric' : 'diane'
  } catch {
    return 'diane'
  }
}

export const useUserStore = defineStore('user', () => {
  const userId = ref<AppUserId>(readSaved())
  const role = computed<Role>(() => APP_USERS.find((user) => user.id === userId.value)!.role)

  function switchTo(id: AppUserId): void {
    userId.value = id
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Storage unavailable (private mode): the choice lasts for this tab only.
    }
  }

  return { userId, role, switchTo }
})
