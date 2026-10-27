<script setup lang="ts">
import { shallowRef } from 'vue'
import { appLogSnapshot, exportAppLogs, recordAppLog } from '../../platform/appLogs'

const snapshot = shallowRef(appLogSnapshot())
const busy = shallowRef(false)
const message = shallowRef('')
async function exportLogs() {
  if (busy.value) return
  busy.value = true; message.value = ''
  try { message.value = await exportAppLogs() }
  catch (error) {
    recordAppLog('logs.export', error)
    message.value = error instanceof Error ? error.message : '日志导出失败，请重试。'
  } finally { snapshot.value = appLogSnapshot(); busy.value = false }
}
</script>

<template>
  <section class="card stack">
    <h3>应用日志</h3>
    <p class="muted">自动记录应用异常及计算失败，最多保留最近 200 条。导出文件包含 App 版本、运行环境和错误详情，便于排查问题。</p>
    <p>已记录 {{ snapshot.logs.length }} 条日志</p>
    <p v-if="!snapshot.storageAvailable" class="amber" role="status">本地日志存储暂不可用，请在关闭应用前导出本次日志。</p>
    <button class="btn" type="button" :disabled="busy" @click="exportLogs">{{ busy ? '正在导出…' : '导出日志 JSON' }}</button>
    <p v-if="message" class="muted" role="status">{{ message }}</p>
  </section>
</template>
