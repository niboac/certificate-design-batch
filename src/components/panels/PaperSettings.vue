<script setup lang="ts">
import { useCanvasStore } from '@/stores/canvas'
import { PAPER_PRESETS } from '@/utils/fonts'
import type { PaperOrientation, PaperUnit } from '@/types'

const canvasStore = useCanvasStore()

// 单位选项
const unitOptions: { value: PaperUnit; label: string }[] = [
  { value: 'mm', label: '毫米' },
  { value: 'cm', label: '厘米' },
  { value: 'px', label: '像素' },
]

// 方向选项
const orientationOptions: { value: PaperOrientation; label: string }[] = [
  { value: 'portrait', label: '竖向' },
  { value: 'landscape', label: '横向' },
]

// 应用预设
function applyPreset(preset: (typeof PAPER_PRESETS)[number]): void {
  canvasStore.updatePaper({
    width: preset.width,
    height: preset.height,
    orientation: preset.orientation,
  })
}
</script>

<template>
  <div class="paper-settings">
    <!-- 预设尺寸 -->
    <div class="panel-section">
      <h3 class="panel-title">
        预设尺寸
      </h3>
      <div class="preset-grid">
        <button
          v-for="preset in PAPER_PRESETS"
          :key="preset.label"
          class="preset-btn"
          :class="{
            active:
              canvasStore.paper.width === preset.width &&
              canvasStore.paper.height === preset.height,
          }"
          @click="applyPreset(preset)"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>

    <!-- 自定义尺寸 -->
    <div class="panel-section">
      <h3 class="panel-title">
        自定义尺寸
      </h3>
      <div class="form-row">
        <div
          class="form-item"
          style="flex: 1"
        >
          <label class="form-label">宽度</label>
          <input
            type="number"
            class="form-input"
            :value="canvasStore.paper.width"
            @input="canvasStore.updatePaper({ width: Number(($event.target as HTMLInputElement).value) })"
          >
        </div>
        <div
          class="form-item"
          style="flex: 1"
        >
          <label class="form-label">高度</label>
          <input
            type="number"
            class="form-input"
            :value="canvasStore.paper.height"
            @input="canvasStore.updatePaper({ height: Number(($event.target as HTMLInputElement).value) })"
          >
        </div>
        <div
          class="form-item"
          style="flex: 1"
        >
          <label class="form-label">单位</label>
          <select
            class="form-select"
            :value="canvasStore.paper.unit"
            @change="canvasStore.updatePaper({ unit: ($event.target as HTMLSelectElement).value as PaperUnit })"
          >
            <option
              v-for="opt in unitOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>
      <div class="form-item">
        <label class="form-label">方向</label>
        <div class="btn-group">
          <button
            v-for="opt in orientationOptions"
            :key="opt.value"
            class="btn-toggle"
            :class="{ active: canvasStore.paper.orientation === opt.value }"
            @click="canvasStore.updatePaper({ orientation: opt.value })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- 背景与网格 -->
    <div class="panel-section">
      <h3 class="panel-title">
        背景与网格
      </h3>
      <div class="form-item">
        <label class="form-label">背景颜色</label>
        <div class="color-picker">
          <input
            type="color"
            :value="canvasStore.paper.backgroundColor"
            @input="canvasStore.updatePaper({ backgroundColor: ($event.target as HTMLInputElement).value })"
          >
          <input
            type="text"
            :value="canvasStore.paper.backgroundColor"
            @input="canvasStore.updatePaper({ backgroundColor: ($event.target as HTMLInputElement).value })"
          >
        </div>
      </div>
      <div class="form-item">
        <label class="form-label">
          <input
            type="checkbox"
            :checked="canvasStore.paper.showGrid"
            @change="canvasStore.updatePaper({ showGrid: ($event.target as HTMLInputElement).checked })"
          >
          显示网格
        </label>
      </div>
      <div
        v-if="canvasStore.paper.showGrid"
        class="form-item"
      >
        <label class="form-label">网格大小</label>
        <div class="range-control">
          <input
            type="range"
            min="2"
            max="50"
            :value="canvasStore.paper.gridSize"
            @input="canvasStore.updatePaper({ gridSize: Number(($event.target as HTMLInputElement).value) })"
          >
          <span class="range-value">{{ canvasStore.paper.gridSize }}px</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paper-settings {
  width: 100%;
}

.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.preset-btn {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.preset-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.preset-btn.active {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 500;
}

.form-item {
  margin-bottom: 10px;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-item label.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.form-item input[type='checkbox'] {
  cursor: pointer;
}

.btn-group {
  display: flex;
  gap: 4px;
}

.btn-toggle {
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-toggle:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-toggle.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
</style>
