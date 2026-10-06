export function newUid(): string {
  const api = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (api?.randomUUID) return api.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16) })
}
