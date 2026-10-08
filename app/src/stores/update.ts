import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { requestJson } from '../update/request'
import { fallbackUpdate } from '../update/fallback'
import { loadJson, saveJson } from '../storage'
import { AppUpdater, supportsUpdates, type DownloadProgress } from '../update/native'
import { LATEST_RELEASE_API, localDate, manifestAsset, releaseVersion, shouldPrompt, validateUpdate,
  type AvailableUpdate, type GitHubRelease, type ReminderState } from '../update/release'
import { compareVersions } from '../update/version'

const KEY = 'app-update-reminders'
type Phase = 'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'ready'


export const useUpdateStore = defineStore('app-update', () => {
  const supported = supportsUpdates()
  const currentVersion = shallowRef(__APP_VERSION__)
  const phase = shallowRef<Phase>('idle')
  const update = shallowRef<AvailableUpdate | null>(null)
  const visible = shallowRef(false)
  const message = shallowRef('')
  const error = shallowRef('')
  const progress = shallowRef<DownloadProgress>({ downloaded: 0, total: 0, phase: 'downloading' })
  const installing = shallowRef(false)
  const busy = computed(() => installing.value || ['checking', 'downloading', 'verifying'].includes(phase.value))
  let started = false
  let reminders: ReminderState = {}

  async function initialize() {
    if (started || !supported) return
    started = true
    await check(false)
  }

  async function check(manual = true) {
    if (!supported || busy.value) return
    const previousPhase = phase.value
    phase.value = 'checking'
    if (manual) { message.value = ''; error.value = '' }
    try {
      reminders = await loadJson<ReminderState>(KEY, {})
      const info = await AppUpdater.getInfo()
      currentVersion.value = info.version
      let release: GitHubRelease | null = null
      let fallback: AvailableUpdate | null = null
      try { release = await requestJson(LATEST_RELEASE_API, true) as GitHubRelease | null }
      catch (cause) {
        try { fallback = await fallbackUpdate() }
        catch { throw cause }
      }
      const version = fallback?.version ?? (release && releaseVersion(release))
      if (!version || compareVersions(version, info.version) <= 0) {
        update.value = null
        phase.value = 'idle'
        if (manual) message.value = release || fallback ? '当前已是最新版本' : '暂无已发布的正式版本'
        return
      }
      const manifest = release && manifestAsset(release)
      if (!manifest && !fallback) throw new Error('最新版本尚未提供完整的 Android 更新产物，请稍后重试')
      const next = fallback ?? validateUpdate(release!, await requestJson(manifest!.browser_download_url))
      const sameDownloadedVersion = update.value?.version === next.version && previousPhase === 'ready'
      update.value = next
      phase.value = sameDownloadedVersion ? 'ready' : 'available'
      if (manual || shouldPrompt(reminders, next.version, localDate())) {
        visible.value = true
        if (!manual) {
          reminders = { ...reminders, promptedVersion: next.version, promptedDate: localDate() }
          await saveJson(KEY, reminders)
        }
      }
    } catch (cause) {
      phase.value = previousPhase
      if (manual) message.value = cause instanceof Error ? cause.message : '检查失败，请检查网络后重试'
    }
  }

  async function dismiss(skip = false) {
    if (busy.value) return
    if (skip && update.value) {
      try {
        reminders = { ...reminders, skippedVersion: update.value.version }
        await saveJson(KEY, reminders)
      } catch { error.value = '无法保存跳过设置，请重试'; return }
    }
    visible.value = false
    error.value = ''
  }

  async function install() {
    if (!update.value || busy.value) return
    error.value = ''
    message.value = ''
    const target = update.value
    installing.value = true
    try {
      if (phase.value !== 'ready') {
        phase.value = 'downloading'
        progress.value = { downloaded: 0, total: target.size, phase: 'downloading' }
        const listener = await AppUpdater.addListener('downloadProgress', (event) => {
          progress.value = event
          phase.value = event.phase
        })
        try { await AppUpdater.download(target) } finally { await listener.remove() }
        phase.value = 'ready'
      }
      const result = await AppUpdater.install(target)
      message.value = result.permissionRequired
        ? '请允许宝睡助手安装应用，返回后点击“继续安装”'
        : '已打开系统安装界面；取消后可点击“继续安装”'
    } catch (cause) {
      if (phase.value !== 'ready' || (cause as { code?: string })?.code === 'FILE_INVALID') phase.value = 'available'
      error.value = cause instanceof Error ? cause.message : '更新失败，请重试'
    } finally {
      installing.value = false
    }
  }

  return { supported, currentVersion, phase, update, visible, message, error, progress, busy,
    initialize, check, dismiss, install }
})
