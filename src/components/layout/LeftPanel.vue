<script setup lang="ts">
import { ref } from "vue";
import { useExcelStore } from "@/stores/excel";
import { useCanvasStore } from "@/stores/canvas";
import PhotoLibrary from "@/components/panels/PhotoLibrary.vue";
import PreviewModal from "@/components/panels/PreviewModal.vue";

const excelStore = useExcelStore();
const canvasStore = useCanvasStore();
const fileInput = ref<HTMLInputElement | null>(null);
const showPreview = ref(false);
const dragOver = ref(false);

// 触发文件选择
function triggerImport(): void {
  fileInput.value?.click();
}

// 处理文件选择
async function handleFileChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  try {
    await excelStore.importFromFile(file);
  } catch {
    // 错误已存入 store
  }
  target.value = "";
}

// 处理拖拽导入
async function handleDrop(event: DragEvent): Promise<void> {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  try {
    await excelStore.importFromFile(file);
  } catch {
    // 错误已存入 store
  }
}

// 插入变量到选中的文本元素
function insertVar(col: string): void {
  const el = canvasStore.selectedElement;
  if (el && el.type === "text") {
    canvasStore.updateElement(el.id, {
      content: `${el.content} {{${col}}}`,
    });
  }
}

// 上一行/下一行预览
function prevRow(): void {
  excelStore.setCurrentRow(excelStore.currentRowIndex - 1);
}

function nextRow(): void {
  excelStore.setCurrentRow(excelStore.currentRowIndex + 1);
}
</script>

<template>
  <aside class="left-panel">
    <!-- 导入区 -->
    <div class="panel-section">
      <h3 class="panel-title">
        数据导入
      </h3>

      <div
        class="drop-zone"
        :class="{ active: dragOver }"
        @click="triggerImport"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="handleDrop"
      >
        <div class="drop-icon">
          +
        </div>
        <p class="drop-text">
          点击或拖拽 Excel 文件到此
        </p>
        <p class="drop-hint">
          支持 .xlsx / .xls / .csv
        </p>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".xlsx,.xls,.csv"
        style="display: none"
        @change="handleFileChange"
      >

      <div
        v-if="excelStore.loading"
        class="status-tip"
      >
        导入中...
      </div>
      <div
        v-if="excelStore.error"
        class="status-tip error"
      >
        {{ excelStore.error }}
      </div>

      <div
        v-if="excelStore.hasData"
        class="file-info"
      >
        <span class="file-name">{{ excelStore.data?.fileName }}</span>
        <button
          class="btn btn-ghost btn-sm"
          @click="excelStore.clear"
        >
          清除
        </button>
      </div>
    </div>

    <!-- 变量列表 -->
    <div
      v-if="excelStore.hasData"
      class="panel-section"
    >
      <h3 class="panel-title">
        可用变量
      </h3>
      <p class="section-hint">
        点击变量插入到选中的文本元素
      </p>
      <div class="var-list">
        <button
          v-for="col in excelStore.columns"
          :key="col"
          class="var-chip"
          @click="insertVar(col)"
        >
          {{ col }}
        </button>
      </div>
    </div>

    <!-- 数据预览 -->
    <div
      v-if="excelStore.hasData"
      class="panel-section preview-section"
    >
      <div class="preview-header">
        <h3 class="panel-title">
          数据预览
        </h3>
        <span class="row-info">
          {{ excelStore.currentRowIndex + 1 }} / {{ excelStore.totalRows }}
        </span>
      </div>

      <div class="row-nav">
        <button
          class="btn btn-default btn-sm"
          :disabled="excelStore.currentRowIndex === 0"
          @click="prevRow"
        >
          上一行
        </button>
        <button
          class="btn btn-default btn-sm"
          :disabled="excelStore.currentRowIndex >= excelStore.totalRows - 1"
          @click="nextRow"
        >
          下一行
        </button>
        <button
          class="btn btn-primary btn-sm"
          @click="showPreview = true"
        >
          预览效果
        </button>
      </div>

      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-index">
                #
              </th>
              <th
                v-for="col in excelStore.columns"
                :key="col"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in excelStore.rows.slice(0, 100)"
              :key="index"
              :class="{ active: index === excelStore.currentRowIndex }"
              @click="excelStore.setCurrentRow(index)"
            >
              <td class="col-index">
                {{ index + 1 }}
              </td>
              <td
                v-for="col in excelStore.columns"
                :key="col"
                :title="row[col]"
              >
                {{ row[col] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="excelStore.totalRows > 100"
        class="table-hint"
      >
        仅显示前 100 行，共 {{ excelStore.totalRows }} 行
      </p>
    </div>

    <!-- 照片库 -->
    <PhotoLibrary />

    <!-- 效果预览弹窗 -->
    <PreviewModal
      v-model:visible="showPreview"
    />
  </aside>
</template>

<style scoped>
.left-panel {
  width: var(--panel-width-left);
  height: 100%;
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  flex-shrink: 0;
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.drop-zone:hover,
.drop-zone.active {
  border-color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.drop-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #f3f4f6;
  color: var(--color-text-secondary);
  font-size: 22px;
  font-weight: 300;
  margin-bottom: 8px;
}

.drop-text {
  font-size: 13px;
  color: var(--color-text);
  margin-bottom: 4px;
}

.drop-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.status-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.status-tip.error {
  color: var(--color-danger);
}

.file-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding: 8px 10px;
  background-color: #f9fafb;
  border-radius: var(--radius-sm);
}

.file-name {
  font-size: 12px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 10px;
}

.var-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.var-chip {
  padding: 4px 10px;
  background-color: #f3f4f6;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.var-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.preview-section {
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row-info {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
}

.row-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.row-nav .btn {
  flex: 1;
}

.data-table-wrapper {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-height: 400px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-table thead {
  position: sticky;
  top: 0;
  background-color: #f9fafb;
  z-index: 1;
}

.data-table th,
.data-table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.data-table th {
  font-weight: 600;
  color: var(--color-text);
}

.data-table td {
  color: var(--color-text-secondary);
}

.col-index {
  width: 36px;
  text-align: center;
  color: var(--color-text-tertiary) !important;
  font-family: var(--font-mono);
}

.data-table tbody tr {
  cursor: pointer;
}

.data-table tbody tr:hover {
  background-color: #f9fafb;
}

.data-table tbody tr.active {
  background-color: var(--color-primary-light);
}

.data-table tbody tr.active td {
  color: var(--color-primary);
}

.table-hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-align: center;
}
</style>
