import Taro from '@tarojs/taro'

let pending: Promise<boolean> | undefined
export function confirmRemoval(message: string): Promise<boolean> {
  if (pending) return Promise.resolve(false)
  pending = Taro.showModal({ title: '确认操作', content: message, confirmText: '确认', cancelText: '取消' })
    .then(result => result.confirm).catch(() => false).finally(() => { pending = undefined })
  return pending
}

export function showValidationError(message: string) {
  void Taro.showModal({ title: '校验失败', content: message, showCancel: false }).catch(() => {})
}
