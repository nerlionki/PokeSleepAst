<script setup lang="ts">
import { exportText } from '#platform/backup'
import { shallowRef } from 'vue'
import { exportNative, exportSdrice, parseBoxText } from '../../calc/boxio'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'

const box = useBoxStore()
const settings = useSettingsStore()
const msg = shallowRef('')
const incoming = shallowRef('')
const mode = shallowRef<'native' | 'sdrice'>('native')

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

function applyImport(replace: boolean) {
  try {
    const parsed = parseBoxText(incoming.value)
    if (!parsed.pokemon.length) {
      msg.value = '没有可导入的宝可梦，请检查 JSON 格式与图鉴编号；盒子未修改'
      return
    }
    if (replace) box.replaceAll(parsed.pokemon)
    else box.merge(parsed.pokemon)
    const label = parsed.source === 'iqdooh' ? 'iqdooh' : parsed.source === 'sdrice' ? 'sdrice' : parsed.source === 'rae' ? 'RAE' : parsed.source === 'native' ? '本机' : '混合'
    msg.value = `${replace ? '覆盖' : '合并'}导入 ${parsed.pokemon.length} 只（${label}）${parsed.skipped ? `，跳过 ${parsed.skipped}` : ''}`
  }
  catch {
    msg.value = 'JSON 无法解析'
  }
}

async function wipe() {
  box.replaceAll([])
  settings.reset()
  msg.value = '已清空盒子并重置设置'
}
</script>
<template>
    <article class="card stack">
      <h3>本机备份</h3>
      <p class="muted">可导入本机 / sdrice 盒子数组 / RAE pokebox / iqdooh 宝可梦盒备份 JSON。缺失字段可在 Box 中补全。</p>
      <div class="field">
        <label>导出格式</label>
        <select v-model="mode">
          <option value="native">本机 schemaVersion 1</option>
          <option value="sdrice">sdrice 盒子数组</option>
        </select>
      </div>
      <button class="btn" type="button" @click="exportBox">导出 Box JSON</button>
      <textarea v-model="incoming" rows="6" placeholder="粘贴本机、sdrice、RAE 或 iqdooh Box JSON"></textarea>
      <div class="row">
        <button class="btn sage" type="button" @click="applyImport(false)">合并导入</button>
        <button class="btn ghost" type="button" @click="applyImport(true)">覆盖导入</button>
      </div>
      <button class="btn ghost" type="button" @click="wipe">清空本机缓存 / 重置设置</button>
      <p v-if="msg" class="amber">{{ msg }}</p>
    </article>

</template>
