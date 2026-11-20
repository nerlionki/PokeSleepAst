import { fileToImage, loadUrl } from '#platform/ocrImages'
import { loadOcr } from './ocrEngine'
import { pokemonPortraitUrl, pokemonShinyPortraitUrl } from './raeImage'
import { ocrIngredientImageUrl } from './ocrAssets'
import { createScreenshotImporter } from './ocrImportCore'
const importer = createScreenshotImporter({ fileToImage, loadUrl, loadOcr, ingredientImageUrl: ocrIngredientImageUrl, pokemonPortraitUrl, pokemonShinyPortraitUrl })
export const { matchSlotLines, importScreenshotFiles } = importer
export type { ImportProgress } from './ocrImportCore'
