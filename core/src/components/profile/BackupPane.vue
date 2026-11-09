<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { confirmRemoval } from '#platform/confirm'
import clientDefaults from '../../data/client-defaults.resource'

import { backupFileHint, exportText, importBackupText } from '#platform/backup'
import { shallowRef } from 'vue'
import { exportNative, exportSdrice, parseBoxText } from '../../calc/boxio'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'
const components_profile_BackupPane_config_clientDefaults = clientDefaults.modules.components_profile_BackupPane


const box = useBoxStore()
const settings = useSettingsStore()
const msg = shallowRef(components_profile_BackupPane_config_clientDefaults["msgInitial"])
const incoming = shallowRef(components_profile_BackupPane_config_clientDefaults["incomingInitial"])
const readingFile = shallowRef(false)
const mode = shallowRef<'native' | 'sdrice'>((components_profile_BackupPane_config_clientDefaults["modeInitial"] as unknown as 'native' | 'sdrice'))

async function exportBox() {
  const payload = mode.value === 'sdrice' ? exportSdrice(box.pokemon) : exportNative(box.pokemon)
  const text = JSON.stringify(payload, null, 2)
  try {
    msg.value = await exportText(text, mode.value === 'sdrice' ? 'sdrice-box.json' : 'pokesleep-box.json')
  }
  catch (cause) {
    msg.value = cause instanceof Error ? cause.message : '导出失败，请重试'
  }
}

async function chooseBackupFile() {
  if (readingFile.value) return
  readingFile.value = true
  try {
    const selected = await importBackupText()
    if (!selected) return
    incoming.value = selected.text
    msg.value = `已读取 ${selected.name}，请选择合并导入或覆盖导入；盒子尚未修改`
  } catch (cause) { msg.value = cause instanceof Error ? cause.message : '文件读取失败，请重试' }
  finally { readingFile.value = false }
}

async function applyImport(replace: boolean) {
  try {
    const parsed = parseBoxText(incoming.value)
    if (!parsed.pokemon.length) {
      msg.value = '没有可导入的宝可梦，请检查 JSON 格式与图鉴编号；盒子未修改'
      return
    }
    if (replace && !await confirmRemoval('确认覆盖盒子？当前盒子内的宝可梦将被替换。')) return
    if (replace) box.replaceAll(parsed.pokemon)
    else box.merge(parsed.pokemon)
    const label = parsed.source === 'iqdooh' ? 'iqdooh' : parsed.source === 'sdrice' ? 'sdrice' : parsed.source === 'native' ? '本机' : '混合'
    msg.value = `${replace ? '覆盖' : '合并'}导入 ${parsed.pokemon.length} 只（${label}）${parsed.skipped ? `，跳过 ${parsed.skipped}` : ''}`
  }
  catch {
    msg.value = 'JSON 无法解析'
  }
}

async function wipe() {
  if (!await confirmRemoval('确认清空盒子并重置设置？')) return
  box.replaceAll([])
  settings.reset()
  msg.value = '已清空盒子并重置设置'
}
</script>
<template>
    <article class="card stack">
      <h3>{{ translateUi("本机备份") }}</h3>
      <p class="muted">{{ translateUi("可导入本机 / sdrice 盒子数组 / iqdooh 宝可梦盒备份 JSON。缺失字段可在 Box 中补全。") }}</p>
      <div class="field">
        <label>{{ translateUi("导出格式") }}</label>
        <select v-model="mode">
          <option value="native">{{ translateUi("本机 schemaVersion 1") }}</option>
          <option value="sdrice">{{ translateUi("sdrice 盒子数组") }}</option>
        </select>
      </div>
      <button class="btn" type="button" @click="exportBox">{{ translateUi("导出 Box JSON") }}</button>
      <button class="btn ghost" type="button" :disabled="readingFile" @click="chooseBackupFile">{{ readingFile ? translateUi("正在读取文件…") : translateUi("选择 JSON 文件") }}</button>
      <p class="muted">{{ backupFileHint }}</p>
      <textarea v-model="incoming" :disabled="readingFile" rows="6" :placeholder="translateUi('粘贴本机、sdrice 或 iqdooh Box JSON')" :aria-label="translateUi('待导入的 Box JSON')"></textarea>
      <div class="row">
        <button class="btn sage" type="button" :disabled="readingFile" @click="applyImport(false)">{{ translateUi("合并导入") }}</button>
        <button class="btn ghost" type="button" :disabled="readingFile" @click="applyImport(true)">{{ translateUi("覆盖导入") }}</button>
      </div>
      <button class="btn ghost" type="button" @click="wipe">{{ translateUi("清空本机缓存 / 重置设置") }}</button>
      <p v-if="msg" class="amber">{{ msg }}</p>
    </article>

</template>
