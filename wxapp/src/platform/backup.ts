import Taro from '@tarojs/taro'
import { readBackupSelection, type BackupSelection } from '../../../core/src/calc/backupFile'
export const backupFileHint = '微信需从聊天会话选择文件，可先将 UTF-8 编码的 .json 备份发到文件传输助手。'
export async function exportText(text: string, name: string): Promise<string> {
  const path = `${wx.env.USER_DATA_PATH}/${name}`
  wx.getFileSystemManager().writeFileSync(path, text, 'utf8')
  if (wx.shareFileMessage) {
    await new Promise<void>((resolve, reject) => wx.shareFileMessage({ filePath: path, fileName: name, success: () => resolve(), fail: reject }))
    return '已打开文件分享'
  }
  await Taro.setClipboardData({ data: text })
  return '已复制到剪贴板'
}
export async function importBackupText(): Promise<BackupSelection | null> {
  let selected: Awaited<ReturnType<typeof Taro.chooseMessageFile>>
  try { selected = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['json', 'JSON'] }) }
  catch (cause) {
    if (/cancel/i.test(String((cause as { errMsg?: string })?.errMsg ?? cause))) return null
    throw new Error('无法选择文件，请重试或使用复制粘贴导入')
  }
  const file = selected.tempFiles[0]
  if (!file) return null
  const text = await new Promise<string>((resolve, reject) => wx.getFileSystemManager().readFile({
    filePath: file.path, encoding: 'utf8',
    success: result => typeof result.data === 'string' ? resolve(result.data) : reject(new Error('文件编码无法识别，请使用 UTF-8 JSON 文件')),
    fail: () => reject(new Error('文件读取失败，请确认文件已下载或重新发送后选择')),
  }))
  return readBackupSelection(file.name, text)
}
