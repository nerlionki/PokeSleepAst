import { fileToImage, loadUrl } from '#platform/ocrImages'
import { loadOcr } from './ocrEngine'
import { ingredientImageUrl, pokemonPortraitUrl, pokemonShinyPortraitUrl } from './raeImage'
import { createScreenshotImporter } from './ocrImportCore'
const importer = createScreenshotImporter({ fileToImage, loadUrl, loadOcr, ingredientImageUrl, pokemonPortraitUrl, pokemonShinyPortraitUrl })
export const { matchSlotLines, importScreenshotFiles } = importer
export type { ImportProgress } from './ocrImportCore'
