<script setup lang="ts">
import PageShell from '../../components/PageShell.vue'
import ShareEntry from '../../components/ShareEntry.vue'
import Content from '../../generated/views/ProfileView.vue'
</script>
<template>
  <PageShell page="profile">
    <Content>
      <template #app-tools>
        <ShareEntry />
      </template>
    </Content>
  </PageShell>
</template>
