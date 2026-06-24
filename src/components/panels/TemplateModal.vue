<script setup lang="ts">
import { ref } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useExcelStore } from '@/stores/excel'
import { TEMPLATES } from '@/data/templates'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const canvasStore = useCanvasStore()
const excelStore = useExcelStore()
const loadingId = ref('')

async function selectTemplate(templateId: string): Promise<void> {
  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template) {
    emit('update:visible', false)
    return
  }

  loadingId.value = templateId
  try {
    // 加载模板
    canvasStore.loadTemplate(template)
    // 加载对应的 Excel 数据
    const response = await fetch(template.csvUrl)
    const blob = await response.blob()
    const file = new File([blob], template.csvName, { type: 'text/csv' })
    await excelStore.importFromFile(file)
  } catch (err) {
    console.error('加载模板数据失败', err)
  } finally {
    loadingId.value = ''
  }
  emit('update:visible', false)
}

function createNew(): void {
  emit('update:visible', false)
}

function downloadTemplate(templateId: string, event: Event): void {
  event.stopPropagation()
  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template) return
  const a = document.createElement('a')
  a.href = template.csvUrl
  a.download = template.csvName
  a.click()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="template-modal"
    >
      <div class="template-modal-content">
        <div class="modal-header">
          <h2 class="modal-title">
            选择模板
          </h2>
        </div>

        <div class="modal-body">
          <p class="modal-desc">
            选择一个模板开始设计，或创建空白画布
          </p>

          <div class="template-grid">
            <div
              v-for="template in TEMPLATES"
              :key="template.id"
              class="template-card"
              :class="{ loading: loadingId === template.id }"
              @click="selectTemplate(template.id)"
            >
              <div class="template-icon">
                {{ template.icon }}
              </div>
              <div class="template-name">
                {{ template.name }}
              </div>
              <div class="template-desc">
                {{ template.description }}
              </div>
              <button
                class="btn-download"
                title="下载示例数据"
                @click="downloadTemplate(template.id, $event)"
              >
                下载示例
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            class="btn btn-default"
            @click="createNew"
          >
            创建空白画布
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.template-modal {
  position: fixed;
  inset: 0;
  background-color: rgb(0 0 0 / 60%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.template-modal-content {
  width: 100%;
  max-width: 600px;
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgb(0 0 0 / 30%);
  overflow: hidden;
}

.modal-header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.modal-body {
  padding: 32px;
}

.modal-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 24px;
  text-align: center;
}

.template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}

.template-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  border-color: var(--color-primary);
  background-color: var(--color-primary-light);
  transform: translateY(-2px);
}

.template-card.loading {
  opacity: 0.6;
  pointer-events: none;
}

.template-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.template-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
}

.template-desc {
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-align: center;
  line-height: 1.4;
  margin-bottom: 12px;
}

.btn-download {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--color-primary);
  background-color: var(--color-surface);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-download:hover {
  background-color: var(--color-primary);
  color: #fff;
}

.modal-footer {
  padding: 20px 32px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: center;
}
</style>