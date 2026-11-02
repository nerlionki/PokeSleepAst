<script setup lang="ts">
import { shallowRef } from 'vue'
import { canSwitchDataSource, switchDataSource } from '#platform/dataSource'
import { activeSnapshot, resourceContext, RESOURCE_ORIGIN, type ResourceContext } from '../../resources/runtime'
import { taskNavigationLocked } from '../../composables/taskNavigationLock'
const current = resourceContext()
const snapshot = activeSnapshot()
const busy = shallowRef(false)
const error = shallowRef('')
async function select(context: ResourceContext) {
  if (busy.value || taskNavigationLocked.value) return
  busy.value = true; error.value = ''
  try { await switchDataSource(context) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '切换失败，请重试' }
  finally { busy.value = false }
}
</script>
<template>
  <section v-if="canSwitchDataSource" class="card stack">
    <h3>数据源</h3>
    <p class="muted">切换后重新打开应用，宝可梦、食谱、食材与计算将使用所选网络数据。</p>
    <p>当前：{{ current === 'test' ? '测试源' : '正式数据源' }} · {{ snapshot ? `资料版本 ${snapshot.manifest.version}` : '网络数据未就绪，正在使用本地兜底资料' }}</p>
    <p class="muted">{{ RESOURCE_ORIGIN }}/{{ current }}/</p>
    <div class="row">
      <button v-for="item in (['prod', 'test'] as const)" :key="item" class="btn" type="button" :disabled="busy || taskNavigationLocked || current === item" @click="select(item)">{{ item === 'prod' ? '正式数据源' : '测试源' }}</button>
    </div>
    <p v-if="error" role="alert" class="amber">{{ error }}</p>
  </section>
</template>
