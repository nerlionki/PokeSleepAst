export async function confirmRemoval(message: string): Promise<boolean> {
  return window.confirm(message)
}
