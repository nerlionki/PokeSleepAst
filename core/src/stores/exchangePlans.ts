import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cloneData } from '../calc/dataClone'
import { emptyExchangePlan, type ExchangePlan } from '../calc/eventExchange'
import { loadJson, saveJson } from '../storage'

const storageKey = 'event-exchange-plans'

export const useExchangePlans = defineStore('exchange-plans', () => {
  const plans = ref<Record<string, ExchangePlan>>({})
  const ready = ref(false)
  const storageError = ref(false)
  let loading: Promise<void> | undefined
  let saving = Promise.resolve()
  let readable = false

  function hydrate() {
    return loading ??= loadJson<Record<string, ExchangePlan>>(storageKey, {})
      .then(value => {
        plans.value = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
        readable = true
      })
      .catch(() => { storageError.value = true })
      .finally(() => { ready.value = true })
  }

  function update(key: string, edit: (plan: ExchangePlan) => void) {
    const previous = plans.value[key]
    const next = previous ? cloneData(previous) : emptyExchangePlan()
    edit(next)
    plans.value[key] = next
    if (!readable) return
    const snapshot = cloneData(plans.value)
    saving = saving.then(() => saveJson(storageKey, snapshot))
      .then(() => { storageError.value = false }, () => { storageError.value = true })
  }

  function reset(key: string) {
    update(key, plan => Object.assign(plan, emptyExchangePlan()))
  }

  return { plans, ready, storageError, hydrate, update, reset }
})
