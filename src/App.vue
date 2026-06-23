<script setup lang="ts">
import TopBar from '@/components/layout/TopBar.vue'
import LeftPanel from '@/components/layout/LeftPanel.vue'
import RightPanel from '@/components/layout/RightPanel.vue'
import DesignCanvas from '@/components/canvas/DesignCanvas.vue'
</script>

<template>
  <div class="app-layout">
    <TopBar />
    <div class="app-body">
      <LeftPanel />
      <DesignCanvas />
      <RightPanel />
    </div>
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
