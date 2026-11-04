import { INGREDIENTS } from './data'
import { ANNOUNCED } from './announcedContent'

/** Display catalog from the active resource snapshot, including partial announcements.
 * Names are stable filter keys; unpublished runtime IDs never become fake IDs.
 * 0 selects the question-mark image when an announcement has no image yet. */
export const INGREDIENT_CATALOG = [
  ...INGREDIENTS.map(row => ({ name: row.name, imageId: row.id, imageFile: (row as { imageFile?: string }).imageFile })),
  ...ANNOUNCED.ingredients
    .filter(row => !INGREDIENTS.some(known => known.name === row.name))
    .map(row => ({ name: row.name, imageId: row.imageId ?? 0, imageFile: row.imageFile })),
].filter((row, index, rows) => rows.findIndex(other => other.name === row.name) === index)
