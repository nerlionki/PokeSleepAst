/** System-installed fonts only: no font files are distributed or downloaded. */
export const fontFamilies = [
  { id: 'system', name: '系统默认', family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'sans', name: '黑体', family: 'Arial, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif' },
  { id: 'serif', name: '宋体', family: '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif' },
] as const
export type FontFamilyId = typeof fontFamilies[number]['id']
export function fontFamilyOf(id: unknown): string {
  return (fontFamilies.find(font => font.id === id) ?? fontFamilies[0]).family
}
