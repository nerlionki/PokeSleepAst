import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { readBackupSelection, type BackupSelection } from '../../../core/src/calc/backupFile'
export const backupFileHint = '选择 UTF-8 编码的 .json 备份文件。'

export function importBackupText(): Promise<BackupSelection | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json,application/json'; input.multiple = false
    input.style.display = 'none'
    input.oncancel = () => { input.remove(); resolve(null) }
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { input.remove(); resolve(null); return }
      try { resolve(readBackupSelection(file.name, await file.text())) }
      catch (cause) { reject(cause instanceof Error ? cause : new Error('文件读取失败，请重新选择')) }
      finally { input.remove() }
    }
    document.body.appendChild(input)
    try { input.click() }
    catch { input.remove(); reject(new Error('无法打开文件选择器，请使用复制粘贴导入')) }
  })
}

export async function exportText(text: string, name: string): Promise<string> {
  try {
    await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    const uri = await Filesystem.getUri({ path: name, directory: Directory.Cache })
    await Share.share({ title: '宝睡盒子', url: uri.uri, dialogTitle: '导出 Box' })
    return '已调起系统分享'
  } catch {
    await navigator.clipboard.writeText(text)
    return '已复制到剪贴板'
  }
}
