import { validateActivityCatalog } from './activityModel'
export function validateActivityResource(data: Record<string, unknown>) {
  const catalog = data['activities.json'] as { schemaVersion?: number } | undefined
  if (catalog?.schemaVersion !== 2) throw new Error('The v2 resource requires activity schema v2')
  validateActivityCatalog(catalog, data)
}
