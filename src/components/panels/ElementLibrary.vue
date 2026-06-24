<script setup lang="ts">
import { ref } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useExcelStore } from '@/stores/excel'

const canvasStore = useCanvasStore()
const excelStore = useExcelStore()
const staticImageInput = ref<HTMLInputElement | null>(null)

// 添加文本元素
function addText(): void {
  canvasStore.addTextElement({
    content: excelStore.hasData ? `{{${excelStore.columns[0]}}}` : '点击编辑文本',
    x: 80,
    y: 80,
  })
}

// 触发静态图片上传
function triggerStaticImage(): void {
  staticImageInput.value?.click()
}

// 处理静态图片上传
function handleStaticImageChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const src = reader.result as string
    canvasStore.addStaticImage(src)
  }
  reader.readAsDataURL(file)
  target.value = ''
}

// 添加动态图片元素
function addDynamicImage(): void {
  const defaultTemplate = excelStore.hasData ? `{{${excelStore.columns[0]}}}.jpg` : ''
  canvasStore.addDynamicImage(defaultTemplate)
}

// 添加变量文本（快速插入）
function addVariableText(col: string): void {
  canvasStore.addTextElement({
    content: `{{${col}}}`,
    x: 80,
    y: 80,
  })
}
</script>

<template>
  <div class="element-library">
    <div class="panel-section">
      <h3 class="panel-title">
        添加元素
      </h3>
      <div class="add-buttons">
        <button
          class="add-btn"
          @click="addText"
        >
          <div class="add-icon">
            T
          </div>
          <span>文本</span>
        </button>
        <button
          class="add-btn"
          @click="triggerStaticImage"
        >
          <div class="add-icon">
            □
          </div>
          <span>静态图片</span>
        </button>
        <button
          class="add-btn"
          @click="addDynamicImage"
        >
          <div class="add-icon">
            ⚙
          </div>
          <span>动态图片</span>
        </button>
        <input
          ref="staticImageInput"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleStaticImageChange"
        >
      </div>
    </div>

    <div
      v-if="excelStore.hasData"
      class="panel-section"
    >
      <h3 class="panel-title">
        快速添加变量
      </h3>
      <p class="section-hint">
        点击直接创建引用该列的文本
      </p>
      <div class="var-grid">
        <button
          v-for="col in excelStore.columns"
          :key="col"
          class="var-btn"
          @click="addVariableText(col)"
        >
          + {{ col }}
        </button>
      </div>
    </div>

    <div
      v-if="canvasStore.elements.length > 0"
      class="panel-section"
    >
      <h3 class="panel-title">
        元素列表
      </h3>
      <div class="element-list">
        <div
          v-for="el in canvasStore.sortedElements.slice().reverse()"
          :key="el.id"
          class="element-item"
          :class="{ active: canvasStore.selectedId === el.id }"
          @click="canvasStore.selectElement(el.id)"
        >
          <span class="element-type">
            {{ el.type === 'text' ? 'T' : el.srcType === 'static' ? '□' : '⚙' }}
          </span>
          <span class="element-name">
            <template v-if="el.type === 'text'">
              {{ el.content.slice(0, 20) || '空文本' }}
            </template>
            <template v-else-if="el.srcType === 'static'">静态图片</template>
            <template v-else>动态图片</template>
          </span>
          <div class="element-actions">
            <button
              class="icon-btn"
              title="复制"
              @click.stop="canvasStore.duplicateElement(el.id)"
            >
              ⧉
            </button>
            <button
              class="icon-btn danger"
              title="删除"
              @click.stop="canvasStore.removeElement(el.id)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.element-library {
  width: 100%;
}

.add-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.add-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  color: var(--color-text);
  transition: all 0.15s ease;
}

.add-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.add-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
  border-radius: var(--radius-sm);
  font-size: 16px;
  font-weight: 600;
}

.add-btn:hover .add-icon {
  background-color: rgb(37 99 235 / 10%);
}

.add-btn span {
  font-size: 12px;
}

.section-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 10px;
}

.var-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.var-btn {
  padding: 5px 10px;
  background-color: #f3f4f6;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.var-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.element-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.element-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.element-item:hover {
  background-color: #f9fafb;
}

.element-item.active {
  background-color: var(--color-primary-light);
}

.element-type {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background-color: #f3f4f6;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.element-item.active .element-type {
  background-color: var(--color-primary);
  color: #fff;
}

.element-name {
  flex: 1;
  font-size: 12px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.element-item:hover .element-actions {
  opacity: 1;
}

.icon-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.icon-btn:hover {
  background-color: #f3f4f6;
}

.icon-btn.danger:hover {
  background-color: #fef2f2;
  color: var(--color-danger);
}
</style>
