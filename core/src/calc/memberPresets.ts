import defaults from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import type { ProduceInput } from '../types'

export const MEMBER_PRESETS = defaults.modules.memberPresets
export function editorMemberFields(): Pick<ProduceInput, 'level' | 'subskills' | 'ingredientSlots'> {
  return cloneData(MEMBER_PRESETS.editor) as Pick<ProduceInput, 'level' | 'subskills' | 'ingredientSlots'>
}
export function extremeMemberFields() {
  return cloneData(MEMBER_PRESETS.extreme) as Pick<ProduceInput, 'level' | 'subskills' | 'ingredientSlots' | 'wakeEnergy' | 'ribbonHours' | 'supportTeamSize'>
}
