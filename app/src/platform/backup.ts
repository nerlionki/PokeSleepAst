import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

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
