import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FontInfo } from '@/types'

// 预设字体列表（作为回退方案）
const FALLBACK_FONTS: FontInfo[] = [
  { name: 'Microsoft YaHei, PingFang SC, sans-serif', label: '微软雅黑', category: 'sans-serif' },
  { name: 'SimSun, STSong, serif', label: '宋体', category: 'serif' },
  { name: 'SimHei, STHeiti, sans-serif', label: '黑体', category: 'sans-serif' },
  { name: 'KaiTi, STKaiti, Kaiti SC, serif', label: '楷体', category: 'serif' },
  { name: 'FangSong, STFangsong, serif', label: '仿宋', category: 'serif' },
  { name: 'Arial, sans-serif', label: 'Arial', category: 'sans-serif' },
  { name: 'Helvetica, Arial, sans-serif', label: 'Helvetica', category: 'sans-serif' },
  { name: 'Times New Roman, serif', label: 'Times New Roman', category: 'serif' },
  { name: 'Georgia, serif', label: 'Georgia', category: 'serif' },
  { name: 'Courier New, monospace', label: 'Courier New', category: 'monospace' },
]

// 字体分类
type FontCategory = 'sans-serif' | 'serif' | 'monospace' | 'cursive' | 'fantasy' | 'other'

// 自定义字体项
export interface CustomFont {
  name: string // 字体名称（用于 font-family）
  label: string // 显示名称
  family: string // FontFace 家族名
  url: string // 字体文件 URL
}

// 判断字体类别
function categorizeFont(family: string): FontCategory {
  const lower = family.toLowerCase()
  if (lower.includes('mono') || lower.includes('code') || lower.includes('courier')) {
    return 'monospace'
  }
  if (lower.includes('serif') || lower.includes('song') || lower.includes('kai') || lower.includes('fang')) {
    return 'serif'
  }
  if (lower.includes('sans') || lower.includes('hei') || lower.includes('yahei')) {
    return 'sans-serif'
  }
  if (lower.includes('cursive') || lower.includes('script')) {
    return 'cursive'
  }
  return 'other'
}

// 格式化字体名称为显示标签
function formatLabel(family: string): string {
  // 中文名直接返回
  if (/[\u4e00-\u9fa5]/.test(family)) {
    return family
  }
  // 英文名保持原样
  return family
}

export const useFontsStore = defineStore('fonts', () => {
  const fonts = ref<FontInfo[]>([])
  const loading = ref(false)
  const error = ref<string>('')
  const permissionGranted = ref(false)
  const apiSupported = ref(false)

  // 自定义字体列表
  const customFonts = ref<CustomFont[]>([])

  // 所有字体（系统字体 + 自定义字体）
  const allFonts = computed(() => {
    const systemFonts = fonts.value.map((f) => ({
      ...f,
      isCustom: false as const,
    }))
    const userFonts = customFonts.value.map((f) => ({
      name: f.name,
      label: f.label,
      category: 'other',
      isCustom: true as const,
    }))
    return [...userFonts, ...systemFonts]
  })

  // 是否使用系统字体（而非回退列表）
  const usingSystemFonts = computed(() => fonts.value.length > 0 && permissionGranted.value)

  // 检查 API 是否支持
  function checkApiSupport(): boolean {
    const supported = 'fonts' in navigator && typeof navigator.fonts?.query === 'function'
    apiSupported.value = supported
    return supported
  }

  // 获取系统字体列表
  async function loadSystemFonts(): Promise<void> {
    if (!checkApiSupport()) {
      fonts.value = FALLBACK_FONTS
      return
    }

    loading.value = true
    error.value = ''

    try {
      // 尝试获取权限
      const status = await navigator.permissions.query({ name: 'font-access' as PermissionName })
      permissionGranted.value = status.state === 'granted'

      if (status.state === 'denied') {
        fonts.value = FALLBACK_FONTS
        return
      }

      // 查询字体
      const fontData = await navigator.fonts.query()
      const fontList: FontInfo[] = []

      for (const font of fontData) {
        const family = font.family
        const category = categorizeFont(family)
        fontList.push({
          name: family,
          label: formatLabel(family),
          category,
        })
      }

      // 按类别排序，中文字体优先
      fontList.sort((a, b) => {
        // 中文字体优先
        const aIsChinese = /[\u4e00-\u9fa5]/.test(a.name)
        const bIsChinese = /[\u4e00-\u9fa5]/.test(b.name)
        if (aIsChinese && !bIsChinese) return -1
        if (!aIsChinese && bIsChinese) return 1
        // 同类别内按名称排序
        if (a.category !== b.category) {
          const order = ['serif', 'sans-serif', 'monospace', 'cursive', 'other']
          return order.indexOf(a.category) - order.indexOf(b.category)
        }
        return a.label.localeCompare(b.label)
      })

      fonts.value = fontList
      permissionGranted.value = true
    } catch (err) {
      // API 调用失败，使用回退列表
      error.value = err instanceof Error ? err.message : '获取字体失败'
      fonts.value = FALLBACK_FONTS
    } finally {
      loading.value = false
    }
  }

  // 添加自定义字体
  async function addCustomFont(file: File): Promise<void> {
    const fontName = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '')
    const fontFamily = `custom_${Date.now()}_${fontName}`
    const url = URL.createObjectURL(file)

    try {
      // 加载字体
      const fontFace = new FontFace(fontFamily, `url(${url})`)
      await fontFace.load()
      document.fonts.add(fontFace)

      const customFont: CustomFont = {
        name: fontFamily,
        label: fontName,
        family: fontFamily,
        url,
      }
      customFonts.value.push(customFont)
    } catch {
      URL.revokeObjectURL(url)
      throw new Error(`字体加载失败: ${file.name}`)
    }
  }

  // 移除自定义字体
  function removeCustomFont(fontName: string): void {
    const index = customFonts.value.findIndex((f) => f.name === fontName)
    if (index !== -1) {
      const font = customFonts.value[index]
      URL.revokeObjectURL(font.url)
      customFonts.value.splice(index, 1)
    }
  }

  // 初始化字体列表
  async function init(): Promise<void> {
    await loadSystemFonts()
  }

  // 获取字体显示名称
  function getFontLabel(fontName: string): string {
    const found = fonts.value.find((f) => f.name === fontName || f.name.startsWith(fontName))
    return found?.label ?? fontName
  }

  return {
    fonts,
    loading,
    error,
    permissionGranted,
    apiSupported,
    usingSystemFonts,
    customFonts,
    allFonts,
    init,
    getFontLabel,
    addCustomFont,
    removeCustomFont,
  }
})