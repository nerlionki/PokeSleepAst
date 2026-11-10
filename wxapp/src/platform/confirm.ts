import { t } from '../../../core/src/ui/i18n'
import Taro from '@tarojs/taro'

let pending: Promise<boolean> | undefined
export function confirmRemoval(message: string, values?: Parameters<typeof t>[1]): Promise<boolean> {
  if (pending) return Promise.resolve(false)
  const cancel = t('取消')
  pending = Taro.showModal({ title: t('确认操作'), content: t(message, values), confirmText: t('确定'), cancelText: cancel.length <= 4 ? cancel : t('返回') })
    .then(result => result.confirm).catch(() => false).finally(() => { pending = undefined })
  return pending
}

export function showValidationError(message: string) {
  void Taro.showModal({ title: t('校验失败'), content: message, confirmText: t('确定'), showCancel: false }).catch(() => {})
}
