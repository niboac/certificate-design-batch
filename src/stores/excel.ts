import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as XLSX from "xlsx";
import type { ExcelData } from "@/types";
import { createDemoData } from "@/utils/demo";

// 将任意编码的 ArrayBuffer 转换为 UTF-8 编码的 ArrayBuffer
// 解决 CSV 文件 GBK/其他编码导致的中文乱码问题
function ensureUtf8(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);

  // 已有 UTF-8 BOM，直接返回
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return buffer;
  }

  // UTF-16 LE BOM
  if (
    bytes.length >= 2 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xfe
  ) {
    const text = new TextDecoder("utf-16le").decode(bytes.slice(2));
    return new TextEncoder().encode(text).buffer;
  }

  // UTF-16 BE BOM
  if (
    bytes.length >= 2 &&
    bytes[0] === 0xfe &&
    bytes[1] === 0xff
  ) {
    const text = new TextDecoder("utf-16be").decode(bytes.slice(2));
    return new TextEncoder().encode(text).buffer;
  }

  // 尝试按 UTF-8 解码，若失败则按 GBK 解码
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    new TextEncoder().encode(text);
    return buffer;
  } catch {
    try {
      const text = new TextDecoder("gbk").decode(bytes);
      return new TextEncoder().encode(text).buffer;
    } catch {
      return buffer;
    }
  }
}

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
      // 检测并处理编码：确保以 UTF-8 解析（解决中文乱码问题）
      const utf8Buffer = ensureUtf8(buffer);
      const workbook = XLSX.read(utf8Buffer, {
        type: "array",
        codepage: 65001, // UTF-8
        cellText: true,
        cellDates: true,
      });
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
