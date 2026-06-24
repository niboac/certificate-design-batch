<script setup lang="ts">
import { computed, watch } from 'vue'
import { useExportStore } from '@/stores/export'
import { useExcelStore } from '@/stores/excel'
import { useCanvasStore } from '@/stores/canvas'
import type { ExportFormat } from '@/types'

const exportStore = useExportStore()
const excelStore = useExcelStore()
const canvasStore = useCanvasStore()

// 格式选项
const formatOptions: { value: ExportFormat; label: string; desc: string }[] = [
  { value: 'pdf', label: 'PDF', desc: '多页文档，适合打印' },
  { value: 'png', label: 'PNG', desc: '无损图片，透明背景' },
  { value: 'jpg', label: 'JPG', desc: '压缩图片，体积小' },
]

// 进度百分比
const progressPercent = computed(() => {
  if (exportStore.total === 0) return 0
  return Math.round((exportStore.progress / exportStore.total) * 100)
})

// 是否可导出
const canExport = computed(
  () => excelStore.hasData && canvasStore.elements.length > 0 && !exportStore.exporting,
)

// 当 Excel 数据变化时，重置导出范围
watch(
  () => excelStore.totalRows,
  (total) => {
    exportStore.startRow = 0
    exportStore.endRow = Math.max(0, total - 1)
  },
  { immediate: true },
)
</script>

<template>
  <div class="export-panel">
    <!-- 导出格式 -->
    <div class="panel-section">
      <h3 class="panel-title">
        导出格式
      </h3>
      <div class="format-list">
        <label
          v-for="opt in formatOptions"
          :key="opt.value"
          class="format-item"
          :class="{ active: exportStore.format === opt.value }"
        >
          <input
            type="radio"
            :value="opt.value"
            :checked="exportStore.format === opt.value"
            @change="exportStore.format = opt.value"
          >
          <div class="format-info">
            <span class="format-name">{{ opt.label }}</span>
            <span class="format-desc">{{ opt.desc }}</span>
          </div>
        </label>
      </div>
    </div>

    <!-- 导出范围 -->
    <div
      v-if="excelStore.hasData"
      class="panel-section"
    >
      <h3 class="panel-title">
        导出范围
      </h3>
      <div class="form-row">
        <div
          class="form-item"
          style="flex: 1"
        >
          <label class="form-label">起始行</label>
          <input
            type="number"
            class="form-input"
            min="0"
            :max="excelStore.totalRows - 1"
            :value="exportStore.startRow"
            @input="exportStore.startRow = Number(($event.target as HTMLInputElement).value)"
          >
        </div>
        <div
          class="form-item"
          style="flex: 1"
        >
          <label class="form-label">结束行</label>
          <input
            type="number"
            class="form-input"
            min="0"
            :max="excelStore.totalRows - 1"
            :value="exportStore.endRow"
            @input="exportStore.endRow = Number(($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>
      <p class="form-hint">
        共 {{ excelStore.totalRows }} 行数据，将导出
        {{ Math.max(0, exportStore.endRow - exportStore.startRow + 1) }} 页
      </p>
    </div>

    <!-- 导出选项 -->
    <div class="panel-section">
      <h3 class="panel-title">
        导出选项
      </h3>
      <div class="form-item">
        <label class="form-label">文件名</label>
        <input
          v-model="exportStore.fileName"
          type="text"
          class="form-input"
          placeholder="批量导出"
        >
      </div>
      <div
        v-if="exportStore.format !== 'pdf'"
        class="form-item"
      >
        <label class="form-label">图片质量</label>
        <div class="range-control">
          <input
            v-model.number="exportStore.quality"
            type="range"
            min="0.1"
            max="1"
            step="0.05"
          >
          <span class="range-value">{{ Math.round(exportStore.quality * 100) }}%</span>
        </div>
      </div>
      <div
        v-if="canvasStore.draft"
        class="form-item"
      >
        <label class="form-label">
          <input
            v-model="exportStore.exportWithDraft"
            type="checkbox"
          >
          导出底稿
        </label>
      </div>
    </div>

    <!-- 导出按钮 -->
    <div class="panel-section">
      <button
        class="btn btn-primary btn-block"
        :disabled="!canExport"
        @click="exportStore.runExport()"
      >
        {{ exportStore.exporting ? '导出中...' : '开始批量导出' }}
      </button>

      <div
        v-if="!excelStore.hasData"
        class="export-tip"
      >
        请先导入 Excel 数据
      </div>
      <div
        v-else-if="canvasStore.elements.length === 0"
        class="export-tip"
      >
        请先在画布上添加元素
      </div>

      <!-- 进度条 -->
      <div
        v-if="exportStore.exporting"
        class="progress-bar"
      >
        <div class="progress-track">
          <div
            class="progress-fill"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <span class="progress-text">
          {{ exportStore.progress }} / {{ exportStore.total }} ({{ progressPercent }}%)
        </span>
      </div>

      <!-- 错误提示 -->
      <div
        v-if="exportStore.error"
        class="export-error"
      >
        {{ exportStore.error }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-panel {
  width: 100%;
}

.format-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.format-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.format-item:hover {
  border-color: var(--color-primary);
}

.format-item.active {
  border-color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.format-item input[type='radio'] {
  cursor: pointer;
}

.format-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.format-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.format-desc {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.form-item {
  margin-bottom: 10px;
}

.form-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.export-tip {
  margin-top: 8px;
  padding: 8px 10px;
  background-color: #fffbeb;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-warning);
  text-align: center;
}

.progress-bar {
  margin-top: 12px;
}

.progress-track {
  width: 100%;
  height: 6px;
  background-color: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: 3px;
  transition: width 0.2s ease;
}

.progress-text {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: center;
  font-family: var(--font-mono);
}

.export-error {
  margin-top: 8px;
  padding: 8px 10px;
  background-color: #fef2f2;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-danger);
}
</style>
