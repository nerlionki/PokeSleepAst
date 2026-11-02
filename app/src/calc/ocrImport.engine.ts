import { installImportWorker } from '../../../core/src/calc/ocrWorker'
import { loadOcr } from './ocrEngine'
installImportWorker(globalThis, handler => { globalThis.onmessage = event => handler(event.data) }, loadOcr)
