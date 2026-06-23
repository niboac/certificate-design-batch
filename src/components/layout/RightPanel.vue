<script setup lang="ts">
import { ref } from "vue";
import ElementLibrary from "@/components/panels/ElementLibrary.vue";
import StyleEditor from "@/components/panels/StyleEditor.vue";
import PaperSettings from "@/components/panels/PaperSettings.vue";
import ExportPanel from "@/components/panels/ExportPanel.vue";

type Tab = "elements" | "style" | "paper" | "export";

const activeTab = ref<Tab>("elements");

const tabs: { key: Tab; label: string }[] = [
  { key: "elements", label: "元素" },
  { key: "style", label: "样式" },
  { key: "paper", label: "稿纸" },
  { key: "export", label: "导出" },
];
</script>

<template>
  <aside class="right-panel">
    <!-- 标签页头 -->
    <div class="tab-header">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 标签页内容 -->
    <div class="tab-content">
      <ElementLibrary v-show="activeTab === 'elements'" />
      <StyleEditor v-show="activeTab === 'style'" />
      <PaperSettings v-show="activeTab === 'paper'" />
      <ExportPanel v-show="activeTab === 'export'" />
    </div>
  </aside>
</template>

<style scoped>
.right-panel {
  width: var(--panel-width-right);
  height: 100%;
  background-color: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.tab-header {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 12px 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--color-text);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 500;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
}
</style>
