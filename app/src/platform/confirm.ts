export async function confirmRemoval(message: string): Promise<boolean> {
  return window.confirm(message)
}

export function showValidationError(message: string) {
  window.alert(message)
}
