export interface ActivityAnnouncement {
  id: string
  name: string
  announcedOn: string | null
  startsOn: string
  endsOn: string
  source: string
}

export interface ActivityArchive {
  schemaVersion: 1
  events: ActivityAnnouncement[]
}

export function validateActivityArchive(value: unknown): asserts value is ActivityArchive {
  const archive = value as ActivityArchive | null
  const date = (s: string) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
    && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s
  const ids = new Set<string>()
  if (!archive || archive.schemaVersion !== 1 || !Array.isArray(archive.events)
    || !archive.events.every(event => {
      if (!event || typeof event.id !== 'string' || !/^[a-z0-9-]+$/.test(event.id) || ids.has(event.id)
        || typeof event.name !== 'string' || !event.name.trim() || event.announcedOn !== null && !date(event.announcedOn)
        || !date(event.startsOn) || !date(event.endsOn) || event.startsOn >= event.endsOn
        || typeof event.source !== 'string' || !/^(?:(?:https:\/\/web\.archive\.org\/web\/\d+\/)?https:\/\/www\.pokemonsleep\.net\/(?:zh\/|en\/)?news\/\d+_?\/|https:\/\/www\.serebii\.net\/pokemonsleep\/events\/[a-z0-9.-]+\.shtml)$/.test(event.source)) return false
      ids.add(event.id)
      return true
    })) throw Error('历史活动公告资料无效')
}
