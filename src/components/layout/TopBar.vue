<script setup lang="ts">
import { ref } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useExcelStore } from '@/stores/excel'

const canvasStore = useCanvasStore()
const excelStore = useExcelStore()

// 工作文件操作：保存/加载设计
const showFileMenu = ref(false)
const showFontMenu = ref(false)
const showAbout = ref(false)

// 保存设计到本地
function saveDesign(): void {
  const payload = {
    elements: canvasStore.elements,
    paper: canvasStore.paper,
    excel: excelStore.data,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `设计文件_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  showFileMenu.value = false
}

// 从本地加载设计
function loadDesign(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text)
      if (Array.isArray(data.elements)) {
        canvasStore.clearElements()
        for (const el of data.elements) {
          canvasStore.elements.push(el)
        }
      }
      if (data.paper) canvasStore.updatePaper(data.paper)
      if (data.excel) {
        excelStore.data = data.excel
      }
    } catch {
      // 忽略解析错误
    }
  }
  input.click()
  showFileMenu.value = false
}

// 清空画布
function clearCanvas(): void {
  if (confirm('确定清空画布所有元素吗？')) {
    canvasStore.clearElements()
  }
  showFileMenu.value = false
}

// 关闭所有菜单
function closeAllMenus(): void {
  showFileMenu.value = false
  showFontMenu.value = false
}
</script>

<template>
  <header class="top-bar">
    <div class="brand">
      <div class="brand-logo">
        证
      </div>
      <div class="brand-text">
        <h1 class="brand-title">
          批量证件设计器
        </h1>
        <p class="brand-subtitle">
          Excel 数据驱动的可视化排版工具
        </p>
      </div>
    </div>

    <div
      class="actions"
      @click="closeAllMenus"
    >
      <div
        class="action-group"
        @click.stop
      >
        <button
          class="btn btn-default btn-sm"
          :class="{ active: showFileMenu }"
          @click="showFileMenu = !showFileMenu; showFontMenu = false"
        >
          工作文件
        </button>
        <div
          v-if="showFileMenu"
          class="dropdown-menu"
        >
          <button
            class="dropdown-item"
            @click="saveDesign"
          >
            保存设计
          </button>
          <button
            class="dropdown-item"
            @click="loadDesign"
          >
            加载设计
          </button>
          <div class="dropdown-divider" />
          <button
            class="dropdown-item danger"
            @click="clearCanvas"
          >
            清空画布
          </button>
        </div>
      </div>

      <div
        class="action-group"
        @click.stop
      >
        <button
          class="btn btn-default btn-sm"
          :class="{ active: showFontMenu }"
          @click="showFontMenu = !showFontMenu; showFileMenu = false"
        >
          字体管理
        </button>
        <div
          v-if="showFontMenu"
          class="dropdown-menu"
        >
          <div class="dropdown-hint">
            使用系统已安装字体
          </div>
          <div class="dropdown-hint">
            在右侧样式面板选择字体
          </div>
        </div>
      </div>

      <button
        class="btn btn-ghost btn-sm"
        @click="showAbout = true"
      >
        关于
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="showAbout"
        class="modal-mask"
        @click="showAbout = false"
      >
        <div
          class="modal-content"
          @click.stop
        >
          <h2 class="modal-title">
            关于批量证件设计器
          </h2>
          <p class="modal-desc">
            一款面向普通用户的可视化排版工具，用于把 Excel 表格中的数据批量生成带有个性化版式的 PDF、PNG 或 JPG。
          </p>
          <ul class="modal-features">
            <li>导入 Excel 数据表，支持变量引用</li>
            <li>可视化画布拖拽排版，所见即所得</li>
            <li>支持文本与图片元素，完整样式控制</li>
            <li>批量导出 PDF / PNG / JPG</li>
          </ul>
          <div class="modal-footer">
            <button
              class="btn btn-primary btn-sm"
              @click="showAbout = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding: 0 20px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  border-radius: var(--radius-md);
}

.brand-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-group {
  position: relative;
}

.btn.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 160px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: 200;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
}

.dropdown-item:hover {
  background-color: #f3f4f6;
}

.dropdown-item.danger {
  color: var(--color-danger);
}

.dropdown-item.danger:hover {
  background-color: #fef2f2;
}

.dropdown-divider {
  height: 1px;
  background-color: var(--color-border);
  margin: 4px 0;
}

.dropdown-hint {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.modal-mask {
  position: fixed;
  inset: 0;
  background-color: rgb(0 0 0 / 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 440px;
  max-width: 90vw;
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}

.modal-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}

.modal-features {
  margin-bottom: 20px;
}

.modal-features li {
  padding: 4px 0;
  font-size: 13px;
  color: var(--color-text);
}

.modal-features li::before {
  content: '·';
  margin-right: 8px;
  color: var(--color-primary);
  font-weight: 700;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
