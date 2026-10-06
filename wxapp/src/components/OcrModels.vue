<script setup lang="ts">
import { shallowRef } from 'vue'
import { hasOcrModels, importOcrModels } from '../platform/ocrEngine'
const ready = shallowRef(hasOcrModels())
const busy = shallowRef(false)
const message = shallowRef('')
async function load() {
  if (busy.value) return
  busy.value = true
  try { await importOcrModels(); ready.value = true; message.value = 'OCR 模型已保存，下次无需重复导入' }
  catch (error) { message.value = error instanceof Error ? error.message : '模型导入取消或失败，请重试' }
  finally { busy.value = false }
}
</script>
<template><view class="card stack"><text>OCR 体验版</text><text class="muted">{{ ready ? '本机已导入模型' : '将提供的模型包解压，把 det.onnx 与 rec.onnx 发到微信，再在这里选择两份文件。' }}</text><button class="btn ghost" :disabled="busy" @tap="load">{{ busy ? '正在导入…' : '导入 OCR 模型' }}</button><text>{{ message }}</text></view></template>
