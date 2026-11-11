<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, shallowRef } from 'vue'
import HorizontalStrip from '#platform/HorizontalStrip.vue'
import { ACTIVITY_CATALOG, localActivityDate, offsetActivityDate, type Activity } from '../../calc/activities'
import { activityNow, retainActivityClock } from '../../composables/activityClock'
import { activeSnapshot } from '../../resources/runtime'
import type { ActivityArchive } from '../../resources/activityArchive'
import { catalogText, t } from '../../ui/i18n'
import DrawerSheet from '../shared/DrawerSheet.vue'
import ActivityDetailPane from './ActivityDetailPane.vue'

type CalendarEvent = Activity & { announcedOn?: string | null }
const eventTitle = (event: CalendarEvent) => catalogText('活动标题', event.id, event.name)
const meta = activeSnapshot()?.data['meta.json'] as { activityArchive?: ActivityArchive } | undefined
const archive = meta?.activityArchive?.events ?? []
const currentEvents = ACTIVITY_CATALOG.activities.map(event => ({
  ...event, announcedOn: archive.find(row => row.id === event.id || row.source === event.source)?.announcedOn,
}))
const archivedEvents = archive
  .filter(row => !currentEvents.some(event => event.id === row.id || event.source === row.source))
  .map(row => ({ ...row, priority: 0, rules: [] }))
const events: CalendarEvent[] = [...currentEvents, ...archivedEvents].sort((a, b) => a.startsOn.localeCompare(b.startsOn))
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const today = computed(() => localActivityDate(new Date(activityNow.value)))
const month = shallowRef(today.value.slice(0, 7))
const selected = shallowRef<CalendarEvent | null>(null)
const dayEvents = shallowRef<CalendarEvent[]>([])
let releaseClock: (() => void) | undefined

function startClock() { releaseClock ??= retainActivityClock() }
function stopClock() {
  releaseClock?.()
  releaseClock = undefined
}
onMounted(startClock)
onActivated(startClock)
onDeactivated(stopClock)
onUnmounted(stopClock)

function stepMonth(delta: number) {
  const first = new Date(`${month.value}-01`)
  first.setUTCMonth(first.getUTCMonth() + delta)
  month.value = first.toISOString().slice(0, 7)
}

function occursOn(event: Activity, day: string) {
  return event.startsOn <= day && day < event.endsOn
    && (!event.weekdays || event.weekdays.includes(new Date(day).getUTCDay()))
}

const highlights = computed(() => currentEvents.filter(event => event.endsOn > today.value)
  .sort((a, b) => Number(occursOn(b, today.value)) - Number(occursOn(a, today.value)) || a.startsOn.localeCompare(b.startsOn)))
const weeks = computed(() => {
  const first = `${month.value}-01`
  const monday = offsetActivityDate(first, -((new Date(first).getUTCDay() + 6) % 7))
  const result = []
  for (let start = monday; start.slice(0, 7) <= month.value; start = offsetActivityDate(start, 7)) {
    const dates = Array.from({ length: 7 }, (_, index) => offsetActivityDate(start, index))
    const days = dates.map(date => ({ date, events: events.filter(event => occursOn(event, date)) }))
    const bars: { event: CalendarEvent; start: number; end: number; lane: number }[] = []
    const laneEnds: number[] = []
    for (let column = 0; column < days.length; column++) {
      for (const event of days[column].events) {
        if (days[column - 1]?.events.includes(event)) continue
        let end = column + 1
        while (days[end]?.events.includes(event)) end++
        const freeLane = laneEnds.findIndex(lastEnd => lastEnd <= column)
        const lane = freeLane < 0 ? laneEnds.length : freeLane
        laneEnds[lane] = end
        bars.push({ event, start: column, end, lane })
      }
    }
    result.push({ start, days, bars })
  }
  return result
})

function openEvent(event: CalendarEvent) {
  dayEvents.value = []
  selected.value = event
}

function openDay(events: CalendarEvent[]) {
  if (events.length === 1) openEvent(events[0])
  else dayEvents.value = events
}

function eventTone(event: Activity) {
  if (event.id.startsWith('good-sleep-day')) return 'full-moon'
  if (event.id.startsWith('new-moon-day')) return 'new-moon'
  return 'calendar-event'
}
</script>

<template>
  <section class="stack calendar-pane">
    <h3>{{ t('活动日历') }}</h3>
    <section class="card stack calendar-summary">
      <h3>{{ t('正在进行 / 即将开始') }}</h3>
      <HorizontalStrip v-if="highlights.length" class="calendar-strip">
        <div class="calendar-highlights">
          <button v-for="event in highlights" :key="event.id" class="calendar-highlight" :class="eventTone(event)" type="button" @click="openEvent(event)">
            <strong>{{ eventTitle(event) }}</strong>
            <span class="muted">{{ event.startsOn }} – {{ offsetActivityDate(event.endsOn, -1) }}</span>
            <span class="highlight-status">{{ occursOn(event, today) ? t('进行中') : t('即将开始') }}</span>
          </button>
        </div>
      </HorizontalStrip>
      <p v-else class="muted">{{ t('暂无进行中或已公布的后续活动。') }}</p>
    </section>

    <section class="card calendar-panel">
      <div class="calendar-heading">
        <button class="btn" type="button" :aria-label="t('上个月')" @click="stepMonth(-1)">‹</button>
        <h3>{{ t('{year}年{month}月', { year: month.slice(0, 4), month: Number(month.slice(5)) }) }}</h3>
        <button class="btn" type="button" :aria-label="t('下个月')" @click="stepMonth(1)">›</button>
      </div>
      <div class="calendar-grid">
        <div class="calendar-weekdays">
          <span v-for="day in weekdays" :key="day">{{ t(day) }}</span>
        </div>
        <div v-for="week in weeks" :key="week.start" class="calendar-week">
          <button v-for="(day, column) in week.days" :key="day.date" class="calendar-day"
            :class="{ outside: !day.date.startsWith(month), today: day.date === today }"
            :style="{ gridColumn: column + 1 }" type="button" :disabled="!day.events.length"
            :aria-label="[day.date, ...day.events.map(eventTitle)].join(' · ')"
            @click="openDay(day.events)">
            <span>{{ Number(day.date.slice(8)) }}</span>
          </button>
          <button v-for="bar in week.bars" :key="`${bar.event.id}-${bar.start}`" type="button"
            class="calendar-bar" :class="eventTone(bar.event)"
            :style="{ gridColumn: `${bar.start + 1} / ${bar.end + 1}`, gridRow: bar.lane + 2 }"
            @click="openEvent(bar.event)">
            {{ eventTitle(bar.event) }}
          </button>
        </div>
      </div>
      <p class="muted calendar-footnote">{{ t('活动日期按当地时间 04:00 切换。') }}</p>
    </section>

    <DrawerSheet v-if="selected" :title="eventTitle(selected)" @close="selected = null">
      <ActivityDetailPane :key="selected.id" :event="selected" :announced-on="selected.announcedOn" />
    </DrawerSheet>
    <DrawerSheet v-else-if="dayEvents.length" :title="t('当天活动')" @close="dayEvents = []">
      <button v-for="event in dayEvents" :key="event.id" class="btn" type="button" @click="openEvent(event)">{{ eventTitle(event) }}</button>
    </DrawerSheet>
  </section>
</template>

<style scoped>
.calendar-pane, .calendar-summary { min-width: 0; grid-template-columns: minmax(0, 1fr); }
.calendar-strip, .calendar-panel { min-width: 0; max-width: 100%; }
.calendar-highlights { display: flex; width: max-content; gap: 8px; }
.calendar-highlight {
  display: grid; gap: 4px; width: 188px; padding: 10px 12px; text-align: left;
  background: var(--card); color: var(--text); border: 1px solid var(--event-color);
  border-radius: 10px; white-space: normal;
}
.calendar-highlight strong { line-height: 1.35; overflow-wrap: anywhere; }
.calendar-highlight span { font-size: 12px; }
.highlight-status { color: var(--event-color); font-weight: 700; }
.calendar-event { --event-color: var(--sage); }
.full-moon { --event-color: var(--amber); }
.new-moon { --event-color: var(--rose); }
.calendar-panel { padding: 10px; }
.calendar-heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; }
.calendar-heading h3 { min-width: 0; margin: 0; text-align: center; overflow-wrap: anywhere; }
.calendar-heading .btn { min-width: 38px; min-height: 36px; padding: 2px 10px; font-size: 21px; }
.calendar-grid { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.calendar-weekdays, .calendar-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.calendar-weekdays { color: var(--muted); text-align: center; padding: 6px 0; font-size: 12px; }
.calendar-week {
  grid-auto-rows: min-content; row-gap: 3px; padding-bottom: 4px; min-height: 60px;
  border-top: 1px solid var(--line);
}
.calendar-day {
  grid-row: 1; min-width: 0; min-height: 28px; padding: 3px 1px; margin: 0;
  background: transparent; border: 0; border-radius: 0; border-right: 1px solid var(--line);
  color: var(--text); font-size: 12px; font-weight: 600;
}
.calendar-day:nth-child(7) { border-right: 0; }
.calendar-day:disabled { opacity: 1; }
.calendar-day.outside { color: var(--muted); }
.calendar-day span { display: inline-block; min-width: 21px; border-radius: 5px; line-height: 20px; }
.calendar-day.today span { background: var(--amber); color: var(--on-accent); }
.calendar-bar {
  min-width: 0; margin: 0 2px; padding: 2px 4px; font-size: 11px; line-height: 17px;
  border: 1px solid var(--event-color); border-radius: 6px; color: var(--text);
  background: var(--ink-2);
  background: color-mix(in srgb, var(--event-color) 12%, var(--card));
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.calendar-footnote { margin-top: 8px; font-size: 12px; }
</style>
