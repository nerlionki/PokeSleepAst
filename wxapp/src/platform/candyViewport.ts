/** Native navigation, status-bar safe area and tab bar are outside windowHeight. */
export function useCandyViewport() {
  return { '--candy-sticky-top': '0px', '--candy-frame-height': 'calc(100vh - 12px)' }
}
