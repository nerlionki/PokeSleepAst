export function selectionList(value: string | readonly string[] | undefined): string[] {
  return [...new Set((Array.isArray(value) ? value : value ? [value] : []).filter(item => item && item !== '全部'))]
}
export function toggleChoice<T extends string | number>(selected: T[], value: T, options: readonly T[] = []) {
  if (!value || value === '全部') { selected.splice(0); return }
  const index = selected.indexOf(value)
  if (index < 0) selected.push(value)
  else selected.splice(index, 1)
  const choices = options.filter(option => option && option !== '全部')
  if (choices.length && choices.every(option => selected.includes(option))) selected.splice(0)
}
export function matchesChoice(selected: readonly string[], value: string | undefined): boolean {
  return !selected.length || (value != null && selected.includes(value))
}
