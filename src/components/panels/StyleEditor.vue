<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { BUILT_IN_FONTS, FONT_SIZE_PRESETS } from '@/utils/fonts'
import type { CanvasElement, FontWeight, ImageFit, TextAlign } from '@/types'

const canvasStore = useCanvasStore()

const element = computed<CanvasElement | null>(() => canvasStore.selectedElement)

// 更新元素属性
function update(patch: Partial<CanvasElement>): void {
  if (!element.value) return
  canvasStore.updateElement(element.value.id, patch)
}

// 更新文本属性
function updateText(patch: Partial<Extract<CanvasElement, { type: 'text' }>>): void {
  if (!element.value || element.value.type !== 'text') return
  canvasStore.updateElement(element.value.id, patch)
}

// 更新图片属性
function updateImage(patch: Partial<Extract<CanvasElement, { type: 'image' }>>): void {
  if (!element.value || element.value.type !== 'image') return
  canvasStore.updateElement(element.value.id, patch)
}

// 对齐方式选项
const alignOptions: { value: TextAlign; label: string }[] = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中' },
  { value: 'right', label: '右' },
]

// 字重选项
const weightOptions: { value: FontWeight; label: string }[] = [
  { value: '300', label: '细' },
  { value: 'normal', label: '常规' },
  { value: '500', label: '中' },
  { value: '600', label: '半粗' },
  { value: 'bold', label: '粗' },
  { value: '800', label: '特粗' },
]

// 图片填充方式
const fitOptions: { value: ImageFit; label: string }[] = [
  { value: 'cover', label: '覆盖' },
  { value: 'contain', label: '包含' },
  { value: 'fill', label: '拉伸' },
  { value: 'none', label: '原始' },
  { value: 'scale-down', label: '缩小' },
]
</script>

<template>
  <div class="style-editor">
    <div
      v-if="!element"
      class="empty-state"
    >
      <p>选中元素后可编辑样式</p>
    </div>

    <template v-else>
      <!-- 位置与尺寸 -->
      <div class="panel-section">
        <h3 class="panel-title">
          位置与尺寸
        </h3>
        <div class="form-grid">
          <div class="form-item">
            <label class="form-label">X</label>
            <input
              type="number"
              class="form-input"
              :value="element.x"
              @input="update({ x: Number(($event.target as HTMLInputElement).value) })"
            >
          </div>
          <div class="form-item">
            <label class="form-label">Y</label>
            <input
              type="number"
              class="form-input"
              :value="element.y"
              @input="update({ y: Number(($event.target as HTMLInputElement).value) })"
            >
          </div>
          <div class="form-item">
            <label class="form-label">宽度</label>
            <input
              type="number"
              class="form-input"
              :value="element.width"
              @input="update({ width: Number(($event.target as HTMLInputElement).value) })"
            >
          </div>
          <div class="form-item">
            <label class="form-label">高度</label>
            <input
              type="number"
              class="form-input"
              :value="element.height"
              @input="update({ height: Number(($event.target as HTMLInputElement).value) })"
            >
          </div>
          <div class="form-item">
            <label class="form-label">旋转</label>
            <input
              type="number"
              class="form-input"
              :value="element.rotation"
              @input="update({ rotation: Number(($event.target as HTMLInputElement).value) })"
            >
          </div>
          <div class="form-item">
            <label class="form-label">透明度</label>
            <div class="range-control">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="element.opacity"
                @input="update({ opacity: Number(($event.target as HTMLInputElement).value) })"
              >
              <span class="range-value">{{ Math.round(element.opacity * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 文本专属属性 -->
      <template v-if="element.type === 'text'">
        <div class="panel-section">
          <h3 class="panel-title">
            文本内容
          </h3>
          <textarea
            class="form-textarea"
            rows="3"
            :value="element.content"
            placeholder="使用 {{列名}} 引用 Excel 数据"
            @input="updateText({ content: ($event.target as HTMLTextAreaElement).value })"
          />
          <p class="form-hint">
            提示：使用 {{ '{列名}' }} 引用 Excel 列数据
          </p>
        </div>

        <div class="panel-section">
          <h3 class="panel-title">
            字体设置
          </h3>
          <div class="form-item">
            <label class="form-label">字体</label>
            <select
              class="form-select"
              :value="element.fontFamily"
              @change="updateText({ fontFamily: ($event.target as HTMLSelectElement).value })"
            >
              <optgroup
                v-for="group in ['sans-serif', 'serif', 'monospace']"
                :key="group"
                :label="group"
              >
                <option
                  v-for="font in BUILT_IN_FONTS.filter((f) => f.category === group)"
                  :key="font.name"
                  :value="font.name"
                >
                  {{ font.label }}
                </option>
              </optgroup>
            </select>
          </div>

          <div class="form-row">
            <div
              class="form-item"
              style="flex: 1"
            >
              <label class="form-label">字号</label>
              <select
                class="form-select"
                :value="element.fontSize"
                @change="updateText({ fontSize: Number(($event.target as HTMLSelectElement).value) })"
              >
                <option
                  v-for="size in FONT_SIZE_PRESETS"
                  :key="size"
                  :value="size"
                >
                  {{ size }}px
                </option>
              </select>
            </div>
            <div
              class="form-item"
              style="flex: 1"
            >
              <label class="form-label">字重</label>
              <select
                class="form-select"
                :value="element.fontWeight"
                @change="updateText({ fontWeight: ($event.target as HTMLSelectElement).value as FontWeight })"
              >
                <option
                  v-for="w in weightOptions"
                  :key="w.value"
                  :value="w.value"
                >
                  {{ w.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div
              class="form-item"
              style="flex: 1"
            >
              <label class="form-label">行高</label>
              <div class="range-control">
                <input
                  type="range"
                  min="0.8"
                  max="3"
                  step="0.1"
                  :value="element.lineHeight"
                  @input="updateText({ lineHeight: Number(($event.target as HTMLInputElement).value) })"
                >
                <span class="range-value">{{ element.lineHeight.toFixed(1) }}</span>
              </div>
            </div>
            <div
              class="form-item"
              style="flex: 1"
            >
              <label class="form-label">字距</label>
              <div class="range-control">
                <input
                  type="range"
                  min="-5"
                  max="20"
                  step="0.5"
                  :value="element.letterSpacing"
                  @input="updateText({ letterSpacing: Number(($event.target as HTMLInputElement).value) })"
                >
                <span class="range-value">{{ element.letterSpacing }}</span>
              </div>
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">对齐方式</label>
            <div class="btn-group">
              <button
                v-for="opt in alignOptions"
                :key="opt.value"
                class="btn-toggle"
                :class="{ active: element.textAlign === opt.value }"
                @click="updateText({ textAlign: opt.value })"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">
              <input
                type="checkbox"
                :checked="element.fontStyle === 'italic'"
                @change="updateText({ fontStyle: ($event.target as HTMLInputElement).checked ? 'italic' : 'normal' })"
              >
              斜体
            </label>
          </div>
        </div>

        <div class="panel-section">
          <h3 class="panel-title">
            颜色与填充
          </h3>
          <div class="form-item">
            <label class="form-label">文字颜色</label>
            <div class="color-picker">
              <input
                type="color"
                :value="element.color"
                @input="updateText({ color: ($event.target as HTMLInputElement).value })"
              >
              <input
                type="text"
                :value="element.color"
                @input="updateText({ color: ($event.target as HTMLInputElement).value })"
              >
            </div>
          </div>
          <div class="form-item">
            <label class="form-label">背景颜色</label>
            <div class="color-picker">
              <input
                type="color"
                :value="element.backgroundColor === 'transparent' ? '#ffffff' : element.backgroundColor"
                @input="updateText({ backgroundColor: ($event.target as HTMLInputElement).value })"
              >
              <input
                type="text"
                :value="element.backgroundColor"
                @input="updateText({ backgroundColor: ($event.target as HTMLInputElement).value })"
              >
            </div>
          </div>
        </div>
      </template>

      <!-- 图片专属属性 -->
      <template v-if="element.type === 'image'">
        <div class="panel-section">
          <h3 class="panel-title">
            图片设置
          </h3>
          <div class="form-item">
            <label class="form-label">填充方式</label>
            <select
              class="form-select"
              :value="element.fit"
              @change="updateImage({ fit: ($event.target as HTMLSelectElement).value as ImageFit })"
            >
              <option
                v-for="opt in fitOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">背景颜色</label>
            <div class="color-picker">
              <input
                type="color"
                :value="element.backgroundColor === 'transparent' ? '#ffffff' : element.backgroundColor"
                @input="updateImage({ backgroundColor: ($event.target as HTMLInputElement).value })"
              >
              <input
                type="text"
                :value="element.backgroundColor"
                @input="updateImage({ backgroundColor: ($event.target as HTMLInputElement).value })"
              >
            </div>
          </div>
        </div>
      </template>

      <!-- 边框与圆角 -->
      <div class="panel-section">
        <h3 class="panel-title">
          边框与圆角
        </h3>
        <div class="form-item">
          <label class="form-label">圆角</label>
          <div class="range-control">
            <input
              type="range"
              min="0"
              max="100"
              :value="element.borderRadius"
              @input="update({ borderRadius: Number(($event.target as HTMLInputElement).value) })"
            >
            <span class="range-value">{{ element.borderRadius }}</span>
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">边框宽度</label>
          <div class="range-control">
            <input
              type="range"
              min="0"
              max="20"
              :value="element.borderWidth"
              @input="update({ borderWidth: Number(($event.target as HTMLInputElement).value) })"
            >
            <span class="range-value">{{ element.borderWidth }}</span>
          </div>
        </div>
        <div
          v-if="element.borderWidth > 0"
          class="form-item"
        >
          <label class="form-label">边框颜色</label>
          <div class="color-picker">
            <input
              type="color"
              :value="element.borderColor"
              @input="update({ borderColor: ($event.target as HTMLInputElement).value })"
            >
            <input
              type="text"
              :value="element.borderColor"
              @input="update({ borderColor: ($event.target as HTMLInputElement).value })"
            >
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="panel-section">
        <div class="action-buttons">
          <button
            class="btn btn-default btn-sm"
            @click="canvasStore.bringToFront(element.id)"
          >
            置顶
          </button>
          <button
            class="btn btn-default btn-sm"
            @click="canvasStore.sendToBack(element.id)"
          >
            置底
          </button>
          <button
            class="btn btn-default btn-sm"
            @click="canvasStore.duplicateElement(element.id)"
          >
            复制
          </button>
          <button
            class="btn btn-danger btn-sm"
            @click="canvasStore.removeElement(element.id)"
          >
            删除
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.style-editor {
  width: 100%;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-text-tertiary);
  font-size: 13px;
  text-align: center;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.form-item {
  margin-bottom: 10px;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-text-tertiary);
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

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
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
</style>
