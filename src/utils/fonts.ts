import type { FontInfo } from '@/types'

// 系统内置字体列表
export const BUILT_IN_FONTS: FontInfo[] = [
  { name: 'Microsoft YaHei', label: '微软雅黑', category: 'sans-serif' },
  { name: 'SimSun', label: '宋体', category: 'serif' },
  { name: 'SimHei', label: '黑体', category: 'sans-serif' },
  { name: 'KaiTi', label: '楷体', category: 'serif' },
  { name: 'FangSong', label: '仿宋', category: 'serif' },
  { name: 'Arial', label: 'Arial', category: 'sans-serif' },
  { name: 'Helvetica', label: 'Helvetica', category: 'sans-serif' },
  { name: 'Times New Roman', label: 'Times New Roman', category: 'serif' },
  { name: 'Georgia', label: 'Georgia', category: 'serif' },
  { name: 'Courier New', label: 'Courier New', category: 'monospace' },
]

// 字号预设
export const FONT_SIZE_PRESETS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96,
]

// 常用稿纸尺寸预设（单位 mm）
export const PAPER_PRESETS = [
  { label: 'A4 竖向', width: 210, height: 297, orientation: 'portrait' as const },
  { label: 'A4 横向', width: 297, height: 210, orientation: 'landscape' as const },
  { label: 'A5 竖向', width: 148, height: 210, orientation: 'portrait' as const },
  { label: 'A5 横向', width: 210, height: 148, orientation: 'landscape' as const },
  { label: '名片 90×54', width: 90, height: 54, orientation: 'landscape' as const },
  { label: '工牌 85×120', width: 85, height: 120, orientation: 'portrait' as const },
  { label: '证书 A4 横', width: 297, height: 210, orientation: 'landscape' as const },
]
