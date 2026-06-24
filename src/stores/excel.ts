import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as XLSX from "xlsx";
import type { ExcelData } from "@/types";
import { createDemoData } from "@/utils/demo";

// Excel 数据 Store：负责导入与预览
export const useExcelStore = defineStore("excel", () => {
  const data = ref<ExcelData | null>(null);
  const loading = ref(false);
  const error = ref<string>("");
  const currentRowIndex = ref(0);

  const hasData = computed(() => !!data.value && data.value.rows.length > 0);
  const columns = computed(() => data.value?.columns ?? []);
  const rows = computed(() => data.value?.rows ?? []);
  const totalRows = computed(() => data.value?.rows.length ?? 0);
  const currentRow = computed(() => {
    if (!data.value || data.value.rows.length === 0) return null;
    return data.value.rows[currentRowIndex.value] ?? null;
  });

  // 从文件对象解析 Excel
  async function importFromFile(file: File): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) {
        throw new Error("工作簿中没有可用的表单");
      }
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        firstSheet,
        {
          defval: "",
          raw: false,
        },
      );
      if (json.length === 0) {
        throw new Error("表单中没有数据行");
      }
      const cols = Object.keys(json[0]);
      const normalizedRows = json.map((row) => {
        const result: Record<string, string> = {};
        for (const col of cols) {
          const value = row[col];
          result[col] =
            value === null || value === undefined ? "" : String(value);
        }
        return result;
      });
      data.value = {
        columns: cols,
        rows: normalizedRows,
        fileName: file.name,
      };
      currentRowIndex.value = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : "导入失败";
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // 跳转到指定行
  function setCurrentRow(index: number): void {
    if (!data.value) return;
    const max = data.value.rows.length - 1;
    currentRowIndex.value = Math.max(0, Math.min(index, max));
  }

  // 清空数据
  function clear(): void {
    data.value = null;
    currentRowIndex.value = 0;
    error.value = "";
  }

  // 加载示例数据（10 条）
  function loadDemo(): void {
    data.value = createDemoData();
    currentRowIndex.value = 0;
    error.value = "";
  }

  return {
    data,
    loading,
    error,
    currentRowIndex,
    hasData,
    columns,
    rows,
    totalRows,
    currentRow,
    importFromFile,
    setCurrentRow,
    clear,
    loadDemo,
  };
});
