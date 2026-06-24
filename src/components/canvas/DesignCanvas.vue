<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useExcelStore } from '@/stores/excel'
import { unitToPx } from '@/utils/element'
import CanvasElementVue from './CanvasElement.vue'
import PreviewModal from '@/components/panels/PreviewModal.vue'

const canvasStore = useCanvasStore()
const excelStore = useExcelStore()
const canvasViewport = ref<HTMLElement | null>(null)
const showPreview = ref(false)

const paperSize = computed(() => ({
  width: unitToPx(canvasStore.paper.width, canvasStore.paper.unit),
  height: unitToPx(canvasStore.paper.height, canvasStore.paper.unit),
}))

const paperWrapperStyle = computed<CSSProperties>(() => ({
  width: `${paperSize.value.width * canvasStore.zoom}px`,
  height: `${paperSize.value.height * canvasStore.zoom}px`,
  flexShrink: 0,
}))

const paperStyle = computed<CSSProperties>(() => ({
  width: `${paperSize.value.width}px`,
  height: `${paperSize.value.height}px`,
  backgroundColor: canvasStore.paper.backgroundColor,
  transform: `scale(${canvasStore.zoom})`,
  transformOrigin: 'top left',
  position: 'absolute',
  left: 0,
  top: 0,
  boxShadow: '0 4px 24px rgb(0 0 0 / 12%)',
}))

const gridStyle = computed<CSSProperties>(() => {
  if (!canvasStore.paper.showGrid) return { display: 'none' }
  const size = canvasStore.paper.gridSize
  return {
    position: 'absolute',
    inset: '0',
    backgroundImage: `
      linear-gradient(to right, rgb(0 0 0 / 4%) 1px, transparent 1px),
      linear-gradient(to bottom, rgb(0 0 0 / 4%) 1px, transparent 1px)
    `,
    backgroundSize: `${size}px ${size}px`,
    pointerEvents: 'none',
    zIndex: 0,
  }
})

const draftStyle = computed<CSSProperties>(() => {
  if (!canvasStore.draft) return { display: 'none' }
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    opacity: canvasStore.draft.opacity,
    pointerEvents: 'none',
    zIndex: 0,
    objectFit: 'fill',
  }
})

function handleViewportClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    canvasStore.selectElement(null)
  }
}

function handleWheel(event: WheelEvent): void {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.05 : 0.05
    canvasStore.setZoom(canvasStore.zoom + delta)
  }
}

const zoomPercent = computed(() => Math.round(canvasStore.zoom * 100))
</script>

<template>
  <div class="canvas-area">
    <!-- 工具栏 -->
    <div class="canvas-toolbar">
      <div class="toolbar-left">
        <button
          class="btn btn-primary btn-sm"
          :disabled="!excelStore.hasData"
          @click="showPreview = true"
        >
          预览
        </button>
        <span class="paper-size-label">
          {{ canvasStore.paper.width }} × {{ canvasStore.paper.height }}
          {{ canvasStore.paper.unit }}
        </span>
      </div>
      <div class="toolbar-right">
        <button
          class="btn btn-ghost btn-sm"
          @click="canvasStore.zoomOut"
        >
          −
        </button>
        <span class="zoom-display">{{ zoomPercent }}%</span>
        <button
          class="btn btn-ghost btn-sm"
          @click="canvasStore.zoomIn"
        >
          +
        </button>
        <button
          class="btn btn-ghost btn-sm"
          @click="canvasStore.resetZoom"
        >
          1:1
        </button>
      </div>
    </div>

    <div
      ref="canvasViewport"
      class="canvas-viewport"
      @click="handleViewportClick"
      @wheel="handleWheel"
    >
      <div
        class="paper-wrapper"
        :style="paperWrapperStyle"
      >
        <div
          class="paper"
          :style="paperStyle"
        >
          <div
            class="grid-layer"
            :style="gridStyle"
          />
          <img
            v-if="canvasStore.draft"
            class="draft-layer"
            :src="canvasStore.draft.src"
            :style="draftStyle"
            alt="底稿"
          >
          <CanvasElementVue
            v-for="el in canvasStore.sortedElements"
            :key="el.id"
            :element="el"
          />
        </div>
      </div>
    </div>

    <div class="canvas-statusbar">
      <span v-if="canvasStore.selectedElement">
        已选中：{{ canvasStore.selectedElement.type === 'text' ? '文本' : '图片' }}
        · X: {{ canvasStore.selectedElement.x }} Y: {{ canvasStore.selectedElement.y }}
        · W: {{ canvasStore.selectedElement.width }} H: {{ canvasStore.selectedElement.height }}
      </span>
      <span
        v-else
        class="status-hint"
      >
        点击元素选中并拖拽 · Ctrl/Cmd + 滚轮缩放
      </span>
    </div>

    <!-- 预览弹窗 -->
    <PreviewModal
      v-model:visible="showPreview"
    />
  </div>
</template>

<style scoped>
.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #ebedf0;
  overflow: hidden;
  min-width: 0;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.paper-size-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoom-display {
  min-width: 48px;
  text-align: center;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
}

.canvas-viewport {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 40px;
}

.paper-wrapper {
  position: relative;
}

.paper {
  position: absolute;
  overflow: hidden;
}

.grid-layer {
  z-index: 0;
}

.draft-layer {
  z-index: 0;
}

.canvas-statusbar {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  flex-shrink: 0;
  min-height: 28px;
}

.status-hint {
  color: var(--color-text-tertiary);
}
</style>
