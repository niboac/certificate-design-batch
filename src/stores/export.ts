import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExportFormat } from '@/types'
import { batchExport } from '@/utils/export'
import { useCanvasStore } from './canvas'
import { useExcelStore } from './excel'
import { usePhotosStore } from './photos'

// 导出 Store：管理导出配置与进度
export const useExportStore = defineStore('export', () => {
  const format = ref<ExportFormat>('pdf')
  const quality = ref(0.92)
  const fileName = ref('批量导出')
  const startRow = ref(0)
  const endRow = ref(0)
  const exporting = ref(false)
  const progress = ref(0)
  const total = ref(0)
  const error = ref<string>('')
  const exportWithDraft = ref(false)

  // 执行批量导出
  async function runExport(): Promise<void> {
    const canvasStore = useCanvasStore()
    const excelStore = useExcelStore()
    const photosStore = usePhotosStore()

    if (!excelStore.hasData) {
      error.value = '请先导入 Excel 数据'
      return
    }
    if (canvasStore.elements.length === 0) {
      error.value = '请先在画布上添加元素'
      return
    }

    exporting.value = true
    error.value = ''
    progress.value = 0

    const allRows = excelStore.rows
    const from = Math.max(0, Math.min(startRow.value, allRows.length - 1))
    const to = Math.max(from, Math.min(endRow.value || allRows.length - 1, allRows.length - 1))
    const rows = allRows.slice(from, to + 1)

    total.value = rows.length

    try {
      await batchExport(
        canvasStore.elements,
        rows,
        canvasStore.paper,
        {
          format: format.value,
          quality: quality.value,
          fileName: fileName.value || '批量导出',
          draft: exportWithDraft.value ? canvasStore.draft : null,
          resolvePhotoUrl: (pathTemplate, row) =>
            photosStore.resolvePhotoUrl(pathTemplate, row),
          onProgress: (current) => {
            progress.value = current
          },
        },
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败'
      error.value = message
    } finally {
      exporting.value = false
    }
  }

  return {
    format,
    quality,
    fileName,
    startRow,
    endRow,
    exporting,
    progress,
    total,
    error,
    exportWithDraft,
    runExport,
  }
})
