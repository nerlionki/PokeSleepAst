import { readonly, shallowRef } from 'vue'

// No resource imports: the mini-program installs its foreground hook before
// downloading the cold-start data snapshot.
const clock = shallowRef(Date.now())
export const activityNow = readonly(clock)
let users = 0
let timer: ReturnType<typeof setTimeout> | undefined

function dateKey(time: number) {
  const date = new Date(time)
  const gameDate = new Date(time)
  gameDate.setHours(gameDate.getHours() - 4)
  return `${date.toDateString()}/${gameDate.toDateString()}/${date.getTimezoneOffset()}`
}

export function nextActivityCheck(now: Date): number {
  const next = new Date(now)
  next.setHours(4, 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime()
}

function schedule() {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
  if (!users) return
  const now = Date.now()
  timer = setTimeout(refreshActivityClock, Math.max(1, nextActivityCheck(new Date(now)) - now))
}

/** Re-evaluate downloaded schedules only; never fetch or replace resources. */
export function refreshActivityClock() {
  const now = Date.now()
  if (dateKey(now) !== dateKey(clock.value)) clock.value = now
  schedule()
}

/** All mounted activity panels share one local-04:00 timer. */
export function retainActivityClock() {
  users++
  refreshActivityClock()
  let retained = true
  return () => {
    if (!retained) return
    retained = false
    users--
    if (!users) {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    }
  }
}
