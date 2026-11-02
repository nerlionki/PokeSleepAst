import { refreshActivityClock } from '../../../core/src/composables/activityClock'

export function installActivityClock() {
  const visible = () => { if (document.visibilityState === 'visible') refreshActivityClock() }
  document.addEventListener('visibilitychange', visible)
  window.addEventListener('focus', refreshActivityClock)
  // MainActivity dispatches this event when the Android WebView resumes.
  window.addEventListener('appCalculationResume', refreshActivityClock)
  refreshActivityClock()
  return () => {
    document.removeEventListener('visibilitychange', visible)
    window.removeEventListener('focus', refreshActivityClock)
    window.removeEventListener('appCalculationResume', refreshActivityClock)
  }
}
