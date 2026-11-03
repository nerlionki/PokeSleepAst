import { createActivityContext, type ActivitySelection } from './activities'

/** A complete empty context suppresses both automatic events and manual overrides. */
export function activitySelection(enabled: boolean, selection?: ActivitySelection, period: 'day' | 'week' | 'research' = 'day') {
  const context = createActivityContext(period, selection)
  return enabled ? context : { startDate: context.startDate, catalog: { schemaVersion: 1 as const, version: 'activities-disabled-v1', activities: [] } }
}
