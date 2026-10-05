import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { AvailableUpdate } from './release'

export interface DownloadProgress { downloaded: number; total: number; phase: 'downloading' | 'verifying' }
interface AppUpdaterPlugin {
  getInfo(): Promise<{ version: string; versionCode: number }>
  download(options: AvailableUpdate): Promise<void>
  install(options: AvailableUpdate): Promise<{ permissionRequired: boolean }>
  addListener(event: 'downloadProgress', listener: (progress: DownloadProgress) => void): Promise<PluginListenerHandle>
}

export const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater')
export const supportsUpdates = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
