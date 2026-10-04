import { Preferences } from '@capacitor/preferences'

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key })
    return value ? JSON.parse(value) as T : fallback
  }
  catch {
    return fallback
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  await Preferences.set({ key, value: JSON.stringify(value) })
}

export async function clearKey(key: string): Promise<void> {
  await Preferences.remove({ key })
}
