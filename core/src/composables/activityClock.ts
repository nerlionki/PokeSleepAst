import { readonly, shallowRef } from 'vue'

// No resource imports: the mini-program installs its foreground hook before
// downloading the cold-start data snapshot.
const clock = shallowRef(Date.now())
export const activityNow = readonly(clock)
const exactClock = shallowRef(clock.value)
export const exactActivityNow = readonly(exactClock)
const boundaryProviders = new Map<symbol, () => number[]>()
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
  let next = nextActivityCheck(new Date(now))
  for (const boundaries of boundaryProviders.values()) {
    for (const boundary of boundaries()) if (now < boundary && boundary < next) next = boundary
  }
  timer = setTimeout(refreshActivityClock, Math.max(1, next - now))
}

/** Re-evaluate downloaded schedules only; never fetch or replace resources. */
export function refreshActivityClock() {
  const now = Date.now()
  if (dateKey(now) !== dateKey(clock.value)) clock.value = now
  if (boundaryProviders.size) exactClock.value = now
  schedule()
}

/** Mounted activity panels share one timer for game days and precise boundaries. */
export function retainActivityClock(boundaries?: () => number[]) {
  const token = Symbol()
  if (boundaries) boundaryProviders.set(token, boundaries)
  users++
  refreshActivityClock()
  let retained = true
  return () => {
    if (!retained) return
    retained = false
    boundaryProviders.delete(token)
    users--
    schedule()
  }
}
