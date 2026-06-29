import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExportFormat, FontWeight, FontStyle } from '@/types'
import { batchExport } from '@/utils/export'
import { useCanvasStore } from './canvas'
import { useExcelStore } from './excel'
import { usePhotosStore } from './photos'
import { useFontsStore } from './fonts'
import type { SystemFontRegistry } from '@/utils/render/fonts'

// 导出 Store：管理导出配置与进度
export const useExportStore = defineStore('export', () => {
  const format = ref<ExportFormat>('pdf')
  const quality = ref(0.92)
  const fileName = ref('批量导出')
  const startRow = ref(0)
  const endRow = ref(0)
  const exporting = ref(false)
  const preparing = ref(false)
  const progress = ref(0)
  const total = ref(0)
  const error = ref<string>('')
  const includeDraft = ref(false)

  // 收集画布中用到的字体（去重）
  function collectUsedFonts(elements: ReturnType<typeof useCanvasStore>['elements']): Array<{ family: string; weight: FontWeight; style: FontStyle }> {
    const fontSet = new Set<string>()
    const result: Array<{ family: string; weight: FontWeight; style: FontStyle }> = []

    for (const el of elements) {
      if (el.type !== 'text' || !el.visible) continue
      const key = `${el.fontFamily}|${el.fontWeight}|${el.fontStyle}`
      if (!fontSet.has(key)) {
        fontSet.add(key)
        result.push({
          family: el.fontFamily,
          weight: el.fontWeight,
          style: el.fontStyle,
        })
      }
    }

    return result
  }

  // 从系统字体 API 获取字体二进制数据
  async function collectSystemFonts(elements: ReturnType<typeof useCanvasStore>['elements']): Promise<SystemFontRegistry> {
    const fontsStore = useFontsStore()
    const systemFonts: SystemFontRegistry = {}

    // 只有当 Font Access API 支持且有权限时才尝试获取
    if (!fontsStore.apiSupported || !fontsStore.permissionGranted) {
      return systemFonts
    }

    const usedFonts = collectUsedFonts(elements)

    for (const font of usedFonts) {
      // 跳过自定义字体（custom_ 开头的）
      if (font.family.startsWith('custom_')) continue

      // 提取基础字体名（去掉 fallback 部分）
      const baseFamily = font.family.split(',')[0].trim().replace(/["']/g, '')
      if (systemFonts[baseFamily]) continue

      try {
        const buffer = await fontsStore.getSystemFontBlob(baseFamily, font.weight, font.style)
        if (buffer) {
          systemFonts[baseFamily] = buffer
        }
      } catch {
        // 单个字体获取失败不影响整体流程
      }
    }

    return systemFonts
  }

  // 执行批量导出
  async function runExport(): Promise<void> {
    const canvasStore = useCanvasStore()
    const excelStore = useExcelStore()
    const photosStore = usePhotosStore()
    const fontsStore = useFontsStore()

    if (!excelStore.hasData) {
      error.value = '请先导入 Excel 数据'
      return
    }
    if (canvasStore.elements.length === 0) {
      error.value = '请先在画布上添加元素'
      return
    }

    exporting.value = true
    preparing.value = true
    error.value = ''
    progress.value = 0

    const allRows = excelStore.rows
    const from = Math.max(0, Math.min(startRow.value, allRows.length - 1))
    const to = Math.max(from, Math.min(endRow.value || allRows.length - 1, allRows.length - 1))
    const rows = allRows.slice(from, to + 1)

    total.value = rows.length

    try {
      // 收集系统字体（用于 PDF 矢量导出时嵌入）
      const systemFonts = await collectSystemFonts(canvasStore.elements)

      await batchExport(
        canvasStore.elements,
        rows,
        canvasStore.paper,
        {
          format: format.value,
          quality: quality.value,
          fileName: fileName.value || '批量导出',
          draft: includeDraft.value ? canvasStore.draft : null,
          customFonts: Object.fromEntries(
            fontsStore.customFonts.map((f) => [f.name, f.url]),
          ),
          systemFonts,
          resolvePhotoUrl: (pathTemplate, row) => photosStore.resolvePhotoUrl(pathTemplate, row),
          onPrepare: () => {
            preparing.value = true
          },
          onStart: () => {
            preparing.value = false
          },
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
      preparing.value = false
    }
  }

  return {
    format,
    quality,
    fileName,
    startRow,
    endRow,
    exporting,
    preparing,
    progress,
    total,
    error,
    includeDraft,
    runExport,
  }
})
