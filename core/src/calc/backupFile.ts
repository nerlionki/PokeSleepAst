import { parseBoxText } from './boxio'

export interface BackupSelection { name: string, text: string }

/** File and clipboard imports share the same format detection and validation. */
export function readBackupSelection(name: string, contents: string): BackupSelection {
  if (!/\.json$/i.test(name)) throw new Error('请选择 .json 文件')
  const text = contents.trim()
  if (!text) throw new Error('JSON 文件为空，原有内容未修改')
  let parsed: ReturnType<typeof parseBoxText>
  try { parsed = parseBoxText(text) }
  catch { throw new Error('文件不是有效的 JSON，请使用 UTF-8 编码的备份文件') }
  if (!parsed.pokemon.length) throw new Error('文件中没有可导入的宝可梦，请检查备份格式与图鉴编号')
  return { name, text }
}
