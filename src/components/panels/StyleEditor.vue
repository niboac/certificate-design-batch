<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useExcelStore } from '@/stores/excel'
import { usePhotosStore } from '@/stores/photos'
import { useFontsStore } from '@/stores/fonts'
import { FONT_SIZE_PRESETS } from '@/utils/fonts'
import type { CanvasElement, FontWeight, ImageFit, TextAlign } from '@/types'

const canvasStore = useCanvasStore()
const excelStore = useExcelStore()
const photosStore = usePhotosStore()
const fontsStore = useFontsStore()
const staticImageInput = ref<HTMLInputElement | null>(null)

// 初始化字体列表
onMounted(() => {
  fontsStore.init()
})

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

// 触发更换静态图片
function triggerReplaceStaticImage(): void {
  staticImageInput.value?.click()
}

// 处理更换静态图片
function handleReplaceStaticImage(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !element.value || element.value.type !== 'image') return
  const reader = new FileReader()
  reader.onload = () => {
    const src = reader.result as string
    canvasStore.updateElement(element.value!.id, { src })
  }
  reader.readAsDataURL(file)
  target.value = ''
}

// 追加文本到路径模板
function appendToPathTemplate(text: string): void {
  if (!element.value || element.value.type !== 'image') return
  const existing = element.value.pathTemplate
  canvasStore.updateElement(element.value.id, {
    pathTemplate: existing + text,
  })
}

// 动态图片解析后的路径预览（使用当前行数据）
const resolvedPathPreview = computed(() => {
  if (!element.value || element.value.type !== 'image' || element.value.srcType !== 'dynamic') return ''
  const template = element.value.pathTemplate
  if (!template) return ''
  const row = excelStore.currentRow ?? {}
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    return row[key.trim()] ?? `{{${key.trim()}}}`
  })
})

// 当前路径是否匹配到照片
const pathMatched = computed(() => {
  if (!resolvedPathPreview.value) return false
  return !!photosStore.findPhotoByPath(resolvedPathPreview.value)
})

// 点击照片路径时插入到模板
function insertPhotoPath(photoPath: string): void {
  if (!element.value || element.value.type !== 'image') return
  canvasStore.updateElement(element.value.id, {
    pathTemplate: photoPath,
  })
}
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
            <label class="form-label">
              字体
              <span
                v-if="fontsStore.loading"
                class="loading-hint"
              >(加载中...)</span>
              <span
                v-else-if="!fontsStore.apiSupported"
                class="api-hint"
              >(预设列表)</span>
              <span
                v-else-if="fontsStore.permissionGranted"
                class="api-hint success"
              >(系统字体)</span>
            </label>
            <select
              class="form-select font-select"
              :value="element.fontFamily"
              @change="updateText({ fontFamily: ($event.target as HTMLSelectElement).value })"
            >
              <optgroup
                v-for="group in ['serif', 'sans-serif', 'monospace', 'cursive', 'other']"
                :key="group"
                :label="group === 'serif' ? '衬线字体' : group === 'sans-serif' ? '无衬线字体' : group === 'monospace' ? '等宽字体' : group === 'cursive' ? '手写字体' : '其他字体'"
              >
                <option
                  v-for="font in fontsStore.fonts.filter((f) => f.category === group)"
                  :key="font.name"
                  :value="font.name"
                  :style="{ fontFamily: font.name }"
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
            <span class="subtitle">
              {{ element.srcType === 'static' ? '静态图片' : '动态图片' }}
            </span>
          </h3>

          <!-- 静态图片 -->
          <template v-if="element.srcType === 'static'">
            <div
              v-if="element.src"
              class="image-preview"
            >
              <img
                :src="element.src"
                alt="预览"
              >
            </div>
            <button
              class="btn btn-default btn-sm btn-block"
              @click="triggerReplaceStaticImage"
            >
              更换图片
            </button>
            <input
              ref="staticImageInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleReplaceStaticImage"
            >
          </template>

          <!-- 动态图片 -->
          <template v-else>
            <div class="form-item">
              <label class="form-label">路径模板</label>
              <textarea
                class="form-textarea path-editor"
                rows="2"
                :value="element.pathTemplate"
                placeholder="例如: photos/{{姓名}}.jpg"
                @input="updateImage({ pathTemplate: ($event.target as HTMLTextAreaElement).value })"
              />
              <div class="path-tips">
                <div class="path-tip-title">
                  路径写法说明：
                </div>
                <ul class="path-tip-list">
                  <li><code v-text="'{{姓名}}'" /> — 引用 Excel 中"姓名"列的值</li>
                  <li><code>photos/</code> — 文件夹前缀（与上传时的文件夹结构一致）</li>
                  <li><code>.jpg</code> — 文件后缀，需与照片实际格式一致</li>
                </ul>
              </div>
            </div>

            <!-- 快速插入：变量 -->
            <div
              v-if="excelStore.hasData"
              class="form-item"
            >
              <label class="form-label">Excel 变量（点击插入）</label>
              <div class="quick-insert-row">
                <button
                  v-for="col in excelStore.columns"
                  :key="col"
                  class="quick-btn"
                  @click="appendToPathTemplate(`{{${col}}}`)"
                >
                  {{ col }}
                </button>
              </div>
            </div>

            <!-- 快速插入：常用后缀和分隔符 -->
            <div class="form-item">
              <label class="form-label">常用字符（点击插入）</label>
              <div class="quick-insert-row">
                <button
                  class="quick-btn"
                  @click="appendToPathTemplate('/')"
                >
                  /
                </button>
                <button
                  class="quick-btn"
                  @click="appendToPathTemplate('.jpg')"
                >
                  .jpg
                </button>
                <button
                  class="quick-btn"
                  @click="appendToPathTemplate('.png')"
                >
                  .png
                </button>
                <button
                  class="quick-btn"
                  @click="appendToPathTemplate('.jpeg')"
                >
                  .jpeg
                </button>
                <button
                  class="quick-btn"
                  @click="appendToPathTemplate('-')"
                >
                  -
                </button>
                <button
                  class="quick-btn"
                  @click="appendToPathTemplate('_')"
                >
                  _
                </button>
              </div>
            </div>

            <!-- 解析预览 -->
            <div
              v-if="element.pathTemplate"
              class="form-item"
            >
              <label class="form-label">当前行解析结果</label>
              <div
                class="resolved-path"
                :class="{ matched: pathMatched, 'not-matched': !pathMatched && resolvedPathPreview }"
              >
                <span
                  v-if="resolvedPathPreview"
                  class="resolved-path-text"
                >{{ resolvedPathPreview }}</span>
                <span
                  v-else
                  class="resolved-path-empty"
                >等待解析...</span>
                <span
                  v-if="pathMatched"
                  class="match-badge success"
                >✓ 已匹配</span>
                <span
                  v-else-if="resolvedPathPreview"
                  class="match-badge fail"
                >✗ 未匹配</span>
              </div>
            </div>

            <!-- 可用照片列表（点击填充路径） -->
            <div
              v-if="photosStore.hasPhotos"
              class="form-item"
            >
              <label class="form-label">
                可用照片（{{ photosStore.totalPhotos }} 张，点击填入路径）
              </label>
              <div class="photo-path-list">
                <button
                  v-for="photo in photosStore.photos.slice(0, 50)"
                  :key="photo.path"
                  class="photo-path-btn"
                  :title="photo.path"
                  @click="insertPhotoPath(photo.path)"
                >
                  {{ photo.path }}
                </button>
                <div
                  v-if="photosStore.totalPhotos > 50"
                  class="photo-path-more"
                >
                  ... 还有 {{ photosStore.totalPhotos - 50 }} 张
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="panel-section">
          <h3 class="panel-title">
            显示设置
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

.loading-hint,
.api-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-left: 6px;
}

.api-hint.success {
  color: #16a34a;
}

.font-select {
  max-height: 300px;
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

.image-preview {
  margin-bottom: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  max-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f9fafb;
}

.image-preview img {
  max-width: 100%;
  max-height: 150px;
  display: block;
}

.btn-block {
  width: 100%;
}

.subtitle {
  font-size: 11px;
  font-weight: normal;
  color: var(--color-text-tertiary);
  margin-left: 6px;
}

.path-editor {
  font-family: var(--font-mono);
  font-size: 12px;
  resize: vertical;
}

.path-tips {
  margin-top: 8px;
  padding: 8px 10px;
  background-color: #f9fafb;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-primary);
}

.path-tip-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.path-tip-list {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.path-tip-list code {
  padding: 1px 4px;
  background-color: #e5e7eb;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-danger);
}

.quick-insert-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.quick-btn {
  padding: 3px 8px;
  background-color: #f3f4f6;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.resolved-path {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #f9fafb;
  border: 1px solid var(--color-border);
  word-break: break-all;
}

.resolved-path.matched {
  background-color: #f0fdf4;
  border-color: #22c55e;
}

.resolved-path.not-matched {
  background-color: #fef2f2;
  border-color: #ef4444;
}

.resolved-path-text {
  flex: 1;
  color: var(--color-text);
}

.resolved-path-empty {
  color: var(--color-text-tertiary);
}

.match-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.match-badge.success {
  color: #16a34a;
  background-color: #dcfce7;
}

.match-badge.fail {
  color: #dc2626;
  background-color: #fee2e2;
}

.photo-path-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px;
}

.photo-path-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  background: none;
  border: none;
  border-radius: 3px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.1s ease;
  word-break: break-all;
  line-height: 1.4;
}

.photo-path-btn:hover {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

.photo-path-more {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-align: center;
}
</style>
