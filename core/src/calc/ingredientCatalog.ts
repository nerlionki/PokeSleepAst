import { INGREDIENTS } from './data'
import { ANNOUNCED } from './announcedContent'

/** Display catalog from the active resource snapshot, including partial announcements.
 * Published entries use their numeric ID. Announcements use their resource key.
 * 0 selects the question-mark image when an announcement has no image yet. */
export const INGREDIENT_CATALOG = [
  ...INGREDIENTS.map(row => ({ id: row.id, key: String(row.id), name: row.name, imageId: row.id, imageFile: (row as { imageFile?: string }).imageFile })),
  ...ANNOUNCED.ingredients
    .filter(row => !INGREDIENTS.some(known => known.name === row.name))
    .map(row => ({ id: undefined, key: `announced:${row.key}`, name: row.name, imageId: row.imageId ?? 0, imageFile: row.imageFile })),
]
