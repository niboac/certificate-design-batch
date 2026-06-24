<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TopBar from '@/components/layout/TopBar.vue'
import LeftPanel from '@/components/layout/LeftPanel.vue'
import RightPanel from '@/components/layout/RightPanel.vue'
import DesignCanvas from '@/components/canvas/DesignCanvas.vue'
import TemplateModal from '@/components/panels/TemplateModal.vue'

const showTemplateModal = ref(false)

onMounted(() => {
  // 每次刷新都显示模板弹窗
  showTemplateModal.value = true
})
</script>

<template>
  <div class="app-layout">
    <TopBar />
    <div class="app-body">
      <LeftPanel />
      <DesignCanvas />
      <RightPanel />
    </div>
    <TemplateModal v-model:visible="showTemplateModal" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}
</style>
