/** Native Worker errors may be plain objects rather than Error instances. */
export function workerErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value) return value
  if (!value || typeof value !== 'object') return fallback
  const event = value as { error?: { message?: string; errMsg?: string }; message?: string; errMsg?: string }
  return event.error?.message || event.error?.errMsg || event.message || event.errMsg || fallback
}
