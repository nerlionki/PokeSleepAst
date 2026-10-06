import Taro from '@tarojs/taro'
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
export async function importBackupText(): Promise<string> {
  const selected = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['json'] })
  return wx.getFileSystemManager().readFileSync(selected.tempFiles[0]!.path, 'utf8') as string
}
