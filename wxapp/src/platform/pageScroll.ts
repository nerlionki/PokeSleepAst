import Taro from '@tarojs/taro'

export function resetPageScroll() {
  void Taro.pageScrollTo({ scrollTop: 0, duration: 0 }).catch(() => {})
}
