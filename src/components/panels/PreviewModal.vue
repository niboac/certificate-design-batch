<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useExcelStore } from '@/stores/excel'
import { usePhotosStore } from '@/stores/photos'
import { interpolateContent } from '@/utils/element'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const canvasStore = useCanvasStore()
const excelStore = useExcelStore()
const photosStore = usePhotosStore()

// 计算预览尺寸
const previewDimensions = computed(() => {
  const { width, height, unit } = canvasStore.paper
  const pxWidth = unit === 'mm' ? width * 3.78 : unit === 'cm' ? width * 37.8 : width
  const pxHeight = unit === 'mm' ? height * 3.78 : unit === 'cm' ? height * 37.8 : height
  return { pxWidth, pxHeight }
})

// 预览时计算缩放
const scaledStyle = computed(() => {
  const { pxWidth, pxHeight } = previewDimensions.value
  const maxWidth = window.innerWidth * 0.8
  const maxHeight = window.innerHeight * 0.7
  const scaleX = maxWidth / pxWidth
  const scaleY = maxHeight / pxHeight
  const scale = Math.min(scaleX, scaleY, 1)
  return {
    width: `${pxWidth}px`,
    height: `${pxHeight}px`,
    transform: `scale(${scale})`,
  }
})

// 当前行数据
const currentRow = computed(() => excelStore.currentRow)

// 排序后的可见元素
const sortedElements = computed(() =>
  canvasStore.sortedElements.filter((el) => el.visible),
)

// 计算元素样式
function getElementStyle(el: typeof sortedElements.value[number]) {
  return {
    position: 'absolute' as const,
    left: `${el.x}px`,
    top: `${el.y}px`,
    width: typeof el.width === 'number' ? `${el.width}px` : el.width,
    height: typeof el.height === 'number' ? `${el.height}px` : el.height,
    transform: `rotate(${el.rotation}deg)`,
    opacity: el.opacity,
    zIndex: el.zIndex,
    boxSizing: 'border-box' as const,
    overflow: 'hidden' as const,
  }
}

// 文本元素内容
function getTextContent(el: typeof sortedElements.value[number]) {
  if (el.type !== 'text') return ''
  return interpolateContent(el.content, currentRow.value ?? {})
}

// 文本元素样式
function getTextStyle(el: Extract<typeof sortedElements.value[number], { type: 'text' }>) {
  return {
    color: el.color,
    fontFamily: el.fontFamily,
    fontSize: `${el.fontSize}px`,
    fontWeight: String(el.fontWeight),
    fontStyle: el.fontStyle,
    textAlign: el.textAlign,
    lineHeight: String(el.lineHeight),
    letterSpacing: `${el.letterSpacing}px`,
    backgroundColor: el.backgroundColor,
    borderWidth: `${el.borderWidth}px`,
    borderStyle: el.borderWidth > 0 ? 'solid' : 'none',
    borderColor: el.borderColor,
    borderRadius: `${el.borderRadius}px`,
    padding: `${el.padding}px`,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start',
  }
}

// 动态图片 URL
function getImageSrc(el: Extract<typeof sortedElements.value[number], { type: 'image' }>) {
  if (el.srcType === 'static') return el.src
  if (!currentRow.value) return ''
  return photosStore.resolvePhotoUrl(el.pathTemplate, currentRow.value)
}

// 图片元素样式
function getImageStyle(el: Extract<typeof sortedElements.value[number], { type: 'image' }>) {
  return {
    borderRadius: `${el.borderRadius}px`,
    borderWidth: `${el.borderWidth}px`,
    borderStyle: el.borderWidth > 0 ? 'solid' : 'none',
    borderColor: el.borderColor,
    backgroundColor: el.backgroundColor,
  }
}

// 关闭预览
function handleClose(): void {
  emit('update:visible', false)
}

// 点击遮罩关闭
function handleOverlayClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="preview-modal"
      @click="handleOverlayClick"
    >
      <div class="preview-header">
        <div class="preview-title">
          效果预览
          <span class="preview-row-info">
            第 {{ excelStore.currentRowIndex + 1 }} / {{ excelStore.totalRows }} 条记录
          </span>
        </div>
        <button
          class="preview-close"
          @click="handleClose"
        >
          ✕
        </button>
      </div>

      <div class="preview-body">
        <div
          class="preview-paper"
          :style="{
            ...scaledStyle,
            backgroundColor: canvasStore.paper.backgroundColor,
          }"
        >
          <!-- 底稿 -->
          <img
            v-if="canvasStore.draft"
            :src="canvasStore.draft.src"
            class="draft-layer"
            :style="{ opacity: canvasStore.draft.opacity }"
          >

          <!-- 元素 -->
          <div
            v-for="el in sortedElements"
            :key="el.id"
            :style="getElementStyle(el)"
          >
            <!-- 文本 -->
            <template v-if="el.type === 'text'">
              <div :style="getTextStyle(el)">
                {{ getTextContent(el) }}
              </div>
            </template>

            <!-- 静态/动态图片 -->
            <template v-else-if="el.type === 'image'">
              <img
                v-if="getImageSrc(el)"
                :src="getImageSrc(el)"
                :style="{
                  ...getImageStyle(el),
                  width: '100%',
                  height: '100%',
                  objectFit: el.fit,
                }"
              >
              <div
                v-else
                class="preview-image-placeholder"
                :style="getImageStyle(el)"
              >
                {{ el.srcType === 'dynamic' ? '动态图片' : '图片' }}
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="preview-footer">
        <div class="preview-nav">
          <button
            class="btn btn-default"
            :disabled="excelStore.currentRowIndex === 0"
            @click="excelStore.setCurrentRow(excelStore.currentRowIndex - 1)"
          >
            上一条
          </button>
          <span class="nav-info">
            {{ excelStore.currentRowIndex + 1 }} / {{ excelStore.totalRows }}
          </span>
          <button
            class="btn btn-default"
            :disabled="excelStore.currentRowIndex >= excelStore.totalRows - 1"
            @click="excelStore.setCurrentRow(excelStore.currentRowIndex + 1)"
          >
            下一条
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.preview-modal {
  position: fixed;
  inset: 0;
  background-color: rgb(0 0 0 / 80%);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: rgb(255 255 255 / 10%);
  flex-shrink: 0;
}

.preview-title {
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview-row-info {
  font-size: 13px;
  font-weight: normal;
  color: rgb(255 255 255 / 60%);
}

.preview-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background-color: rgb(255 255 255 / 10%);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.preview-close:hover {
  background-color: rgb(255 255 255 / 20%);
}

.preview-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 24px;
}

.preview-paper {
  position: relative;
  transform-origin: center center;
  box-shadow: 0 8px 32px rgb(0 0 0 / 50%);
  flex-shrink: 0;
}

.draft-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.preview-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.preview-footer {
  padding: 16px 24px;
  background-color: rgb(255 255 255 / 10%);
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

.preview-nav {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-info {
  color: #fff;
  font-size: 14px;
  font-family: var(--font-mono);
  min-width: 80px;
  text-align: center;
}
</style>
