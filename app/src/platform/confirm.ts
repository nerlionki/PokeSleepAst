import { t } from '../../../core/src/ui/i18n'
export async function confirmRemoval(message: string, values?: Parameters<typeof t>[1]): Promise<boolean> {
  return window.confirm(t(message, values))
}

export function showValidationError(message: string) {
  window.alert(message)
}
