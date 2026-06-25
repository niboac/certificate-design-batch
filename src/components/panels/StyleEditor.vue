<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useExcelStore } from '@/stores/excel'
import { usePhotosStore } from '@/stores/photos'
import { useFontsStore } from '@/stores/fonts'
import { FONT_SIZE_PRESETS } from '@/utils/fonts'
import { interpolateContent } from '@/utils/element'
import type { CanvasElement, FontWeight, ImageFit, ImageSourceType, TextAlign } from '@/types'

const canvasStore = useCanvasStore()
const excelStore = useExcelStore()
const photosStore = usePhotosStore()
const fontsStore = useFontsStore()

onMounted(() => {
  fontsStore.init()
})

const customFontInput = ref<HTMLInputElement | null>(null)
const fontUploadError = ref('')

function triggerUploadFont(): void {
  customFontInput.value?.click()
}

async function handleUploadFont(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  fontUploadError.value = ''
  const validExtensions = ['.ttf', '.otf', '.woff', '.woff2']
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!validExtensions.includes(ext)) {
    fontUploadError.value = '仅支持 ttf, otf, woff, woff2 格式'
    target.value = ''
    return
  }

  try {
    await fontsStore.addCustomFont(file)
  } catch (err) {
    fontUploadError.value = err instanceof Error ? err.message : '字体加载失败'
  }
  target.value = ''
}

function handleRemoveCustomFont(fontName: string): void {
  fontsStore.removeCustomFont(fontName)
}

const element = computed<CanvasElement | null>(() => canvasStore.selectedElement)

const imageInput = ref<HTMLInputElement | null>(null)
const pathTemplateInput = ref<HTMLInputElement | null>(null)

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

// 解析尺寸值（支持数字和字符串）
function parseSizeValue(value: string): number | string {
  const trimmed = value.trim()
  if (trimmed === 'auto' || trimmed.endsWith('%')) {
    return trimmed
  }
  const num = Number(trimmed)
  return isNaN(num) ? trimmed : num
}

// 处理宽度/高度输入
function handleSizeInput(prop: 'width' | 'height', event: Event): void {
  const target = event.target as HTMLInputElement
  update({ [prop]: parseSizeValue(target.value) } as Partial<CanvasElement>)
}

// 触发静态图片更换
function triggerStaticImageChange(): void {
  imageInput.value?.click()
}

// 处理静态图片更换
function handleStaticImageChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const src = reader.result as string
    updateImage({ srcType: 'static', src })
  }
  reader.readAsDataURL(file)
  target.value = ''
}

// 切换图片类型
function switchImageType(type: ImageSourceType): void {
  if (!element.value || element.value.type !== 'image') return
  if (element.value.srcType === type) return
  if (type === 'static') {
    updateImage({ srcType: 'static' })
  } else {
    updateImage({ srcType: 'dynamic' })
  }
}

// 插入变量到路径模板
function insertVariable(col: string): void {
  if (!element.value || element.value.type !== 'image') return
  const input = pathTemplateInput.value
  if (!input) {
    updateImage({ pathTemplate: element.value.pathTemplate + `{{${col}}}` })
    return
  }
  const start = input.selectionStart ?? element.value.pathTemplate.length
  const end = input.selectionEnd ?? element.value.pathTemplate.length
  const template = element.value.pathTemplate
  const newTemplate = template.slice(0, start) + `{{${col}}}` + template.slice(end)
  updateImage({ pathTemplate: newTemplate })
  requestAnimationFrame(() => {
    const newPos = start + `{{${col}}}`.length
    input.setSelectionRange(newPos, newPos)
    input.focus()
  })
}

// 插入常用字符
function insertCommonText(text: string): void {
  if (!element.value || element.value.type !== 'image') return
  const input = pathTemplateInput.value
  if (!input) {
    updateImage({ pathTemplate: element.value.pathTemplate + text })
    return
  }
  const start = input.selectionStart ?? element.value.pathTemplate.length
  const end = input.selectionEnd ?? element.value.pathTemplate.length
  const template = element.value.pathTemplate
  const newTemplate = template.slice(0, start) + text + template.slice(end)
  updateImage({ pathTemplate: newTemplate })
  requestAnimationFrame(() => {
    const newPos = start + text.length
    input.setSelectionRange(newPos, newPos)
    input.focus()
  })
}

// 当前行动态图片解析结果
const dynamicPreview = computed(() => {
  if (!element.value || element.value.type !== 'image') return null
  if (element.value.srcType !== 'dynamic') return null
  if (!excelStore.hasData || !excelStore.currentRow) return null
  const row = excelStore.currentRow
  const resolvedPath = interpolateContent(element.value.pathTemplate, row)
  const photo = photosStore.findPhotoByPath(resolvedPath)
  return {
    resolvedPath,
    matched: !!photo,
    url: photo?.url ?? '',
  }
})

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

// 图片类型选项
const srcTypeOptions: { value: ImageSourceType; label: string }[] = [
  { value: 'static', label: '静态' },
  { value: 'dynamic', label: '动态' },
]

// 常用字符按钮
const commonChars = ['.jpg', '.png', '.jpeg', '.gif', '/', '\\']
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
              type="text"
              class="form-input"
              :value="element.width"
              placeholder="px / auto / %"
              @input="handleSizeInput('width', $event)"
            >
          </div>
          <div class="form-item">
            <label class="form-label">高度</label>
            <input
              type="text"
              class="form-input"
              :value="element.height"
              placeholder="px / auto / %"
              @input="handleSizeInput('height', $event)"
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
        <p class="form-hint">
          宽高支持数字(px)、auto、百分比(如 50%)
        </p>
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

          <div
            v-if="fontsStore.customFonts.length > 0"
            class="custom-fonts-section"
          >
            <label class="form-label">已上传字体</label>
            <div class="custom-font-list">
              <div
                v-for="font in fontsStore.customFonts"
                :key="font.name"
                class="custom-font-item"
              >
                <span :style="{ fontFamily: font.name }">{{ font.label }}</span>
                <button
                  class="btn-remove"
                  title="移除"
                  @click="handleRemoveCustomFont(font.name)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <div class="form-item">
            <div class="form-label-row">
              <label class="form-label">字体</label>
              <button
                class="btn-upload-font"
                @click="triggerUploadFont"
              >
                上传字体
              </button>
              <input
                ref="customFontInput"
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                hidden
                @change="handleUploadFont"
              >
            </div>
            <p
              v-if="fontUploadError"
              class="form-error"
            >
              {{ fontUploadError }}
            </p>
            <select
              class="form-select font-select"
              :value="element.fontFamily"
              @change="updateText({ fontFamily: ($event.target as HTMLSelectElement).value })"
            >
              <optgroup
                v-if="fontsStore.customFonts.length > 0"
                label="自定义字体"
              >
                <option
                  v-for="font in fontsStore.customFonts"
                  :key="font.name"
                  :value="font.name"
                  :style="{ fontFamily: font.name }"
                >
                  {{ font.label }}
                </option>
              </optgroup>
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
          </h3>
          <div class="form-item">
            <label class="form-label">图片类型</label>
            <div class="btn-group">
              <button
                v-for="opt in srcTypeOptions"
                :key="opt.value"
                class="btn-toggle"
                :class="{ active: element.srcType === opt.value }"
                @click="switchImageType(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- 静态图片 -->
          <div
            v-if="element.srcType === 'static'"
            class="static-image-section"
          >
            <div class="form-item">
              <label class="form-label">当前图片</label>
              <div class="image-preview-box">
                <img
                  v-if="element.src"
                  :src="element.src"
                  alt="预览"
                >
                <div
                  v-else
                  class="no-image"
                >
                  未选择图片
                </div>
              </div>
            </div>
            <button
              class="btn btn-default btn-sm btn-block"
              @click="triggerStaticImageChange"
            >
              更换图片
            </button>
            <input
              ref="imageInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleStaticImageChange"
            >
          </div>

          <!-- 动态图片 -->
          <div
            v-else
            class="dynamic-image-section"
          >
            <div class="form-item">
              <label class="form-label">路径模板</label>
              <input
                ref="pathTemplateInput"
                type="text"
                class="form-input path-template-input"
                :value="element.pathTemplate"
                placeholder="例如: photos/{{姓名}}.jpg"
                @input="updateImage({ pathTemplate: ($event.target as HTMLInputElement).value })"
              >
              <p class="form-hint">
                使用 {{ '{列名}' }} 引用 Excel 列数据
              </p>
            </div>

            <!-- 可用变量 -->
            <div
              v-if="excelStore.hasData"
              class="form-item"
            >
              <label class="form-label">可用变量</label>
              <div class="var-buttons">
                <button
                  v-for="col in excelStore.columns"
                  :key="col"
                  class="var-chip"
                  @click="insertVariable(col)"
                >
                  {{ col }}
                </button>
              </div>
            </div>

            <!-- 常用字符 -->
            <div class="form-item">
              <label class="form-label">常用字符</label>
              <div class="common-chars">
                <button
                  v-for="char in commonChars"
                  :key="char"
                  class="char-btn"
                  @click="insertCommonText(char)"
                >
                  {{ char }}
                </button>
              </div>
            </div>

            <!-- 解析预览 -->
            <div class="form-item">
              <label class="form-label">当前行预览</label>
              <div
                v-if="dynamicPreview"
                class="preview-result"
                :class="{ matched: dynamicPreview.matched, unmatched: !dynamicPreview.matched }"
              >
                <div class="preview-path">
                  <span class="preview-label">解析路径：</span>
                  <span class="preview-path-text">{{ dynamicPreview.resolvedPath || '(空)' }}</span>
                </div>
                <div class="preview-status">
                  <span
                    v-if="dynamicPreview.matched"
                    class="status-badge status-success"
                  >
                    ✓ 匹配成功
                  </span>
                  <span
                    v-else
                    class="status-badge status-error"
                  >
                    ✕ 未匹配
                  </span>
                </div>
                <div
                  v-if="dynamicPreview.matched && dynamicPreview.url"
                  class="preview-image-box"
                >
                  <img
                    :src="dynamicPreview.url"
                    alt="预览"
                  >
                </div>
              </div>
              <div
                v-else
                class="preview-result empty"
              >
                <span class="empty-text">导入 Excel 数据后可预览</span>
              </div>
            </div>

            <!-- 照片库快速填充 -->
            <div
              v-if="photosStore.hasPhotos"
              class="form-item"
            >
              <label class="form-label">照片库（点击填入路径）</label>
              <div class="photo-fill-list">
                <button
                  v-for="photo in photosStore.photos.slice(0, 10)"
                  :key="photo.path"
                  class="photo-fill-item"
                  :title="photo.path"
                  @click="updateImage({ pathTemplate: photo.path })"
                >
                  <img
                    :src="photo.url"
                    :alt="photo.name"
                  >
                  <span class="photo-fill-name">{{ photo.name }}</span>
                </button>
              </div>
              <p
                v-if="photosStore.totalPhotos > 10"
                class="form-hint"
              >
                共 {{ photosStore.totalPhotos }} 张，仅显示前 10 张
              </p>
            </div>
          </div>

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

.static-image-section {
  margin-bottom: 12px;
}

.image-preview-box {
  width: 100%;
  height: 100px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background-color: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.image-preview-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-image {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.dynamic-image-section {
  margin-bottom: 12px;
}

.path-template-input {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
}

.var-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.var-chip {
  padding: 4px 10px;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  font-size: 11px;
  color: #1d4ed8;
  cursor: pointer;
  transition: all 0.15s ease;
}

.var-chip:hover {
  background-color: #dbeafe;
  border-color: #93c5fd;
}

.common-chars {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.char-btn {
  padding: 4px 10px;
  background-color: #f3f4f6;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-family: var(--font-mono, monospace);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.char-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.preview-result {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px;
  background-color: #f9fafb;
}

.preview-result.matched {
  border-color: #86efac;
  background-color: #f0fdf4;
}

.preview-result.unmatched {
  border-color: #fca5a5;
  background-color: #fef2f2;
}

.preview-result.empty {
  text-align: center;
  padding: 20px;
}

.preview-path {
  font-size: 11px;
  margin-bottom: 6px;
  word-break: break-all;
}

.preview-label {
  color: var(--color-text-tertiary);
}

.preview-path-text {
  font-family: var(--font-mono, monospace);
  color: var(--color-text);
}

.preview-status {
  margin-bottom: 8px;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.status-success {
  background-color: #dcfce7;
  color: #166534;
}

.status-error {
  background-color: #fee2e2;
  color: #991b1b;
}

.preview-image-box {
  width: 100%;
  height: 80px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.empty-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.photo-fill-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.photo-fill-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
}

.photo-fill-item:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.photo-fill-item img {
  width: 100%;
  height: 40px;
  object-fit: cover;
  border-radius: 2px;
}

.photo-fill-name {
  font-size: 10px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.form-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-upload-font {
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-upload-font:hover {
  background-color: var(--color-primary);
  color: #fff;
}

.form-error {
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-danger);
}

.custom-fonts-section {
  margin-bottom: 12px;
  padding: 8px 10px;
  background-color: #f9fafb;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.custom-font-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.custom-font-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.btn-remove {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background-color: #fee2e2;
  color: #dc2626;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn-remove:hover {
  background-color: #fecaca;
}

.font-select {
  max-height: 300px;
}
</style>
