// 元素类型枚举
export type ElementType = 'text' | 'image'

// 文本对齐方式
export type TextAlign = 'left' | 'center' | 'right'

// 图片填充方式
export type ImageFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'

// 稿纸尺寸单位
export type PaperUnit = 'mm' | 'px' | 'cm'

// 稿纸方向
export type PaperOrientation = 'portrait' | 'landscape'

// 导出格式
export type ExportFormat = 'pdf' | 'png' | 'jpg'

// 字重
export type FontWeight = 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800' | '900'

// 字体风格
export type FontStyle = 'normal' | 'italic'

// 元素基础属性
export interface BaseElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  opacity: number
  visible: boolean
  locked: boolean
}

// 文本元素
export interface TextElement extends BaseElement {
  type: 'text'
  content: string
  fontFamily: string
  fontSize: number
  color: string
  fontWeight: FontWeight
  fontStyle: FontStyle
  textAlign: TextAlign
  lineHeight: number
  letterSpacing: number
  backgroundColor: string
  borderWidth: number
  borderColor: string
  borderRadius: number
  padding: number
}

// 图片元素
export interface ImageElement extends BaseElement {
  type: 'image'
  src: string
  fit: ImageFit
  backgroundColor: string
  borderRadius: number
  borderWidth: number
  borderColor: string
}

// 画布元素联合类型
export type CanvasElement = TextElement | ImageElement

// 稿纸配置
export interface PaperConfig {
  width: number
  height: number
  unit: PaperUnit
  orientation: PaperOrientation
  backgroundColor: string
  showGrid: boolean
  gridSize: number
}

// 底稿配置
export interface DraftConfig {
  src: string // 底稿图片 URL（Base64 或普通 URL）
  opacity: number
}

// Excel 数据结构
export interface ExcelData {
  columns: string[]
  rows: Record<string, string>[]
  fileName: string
}

// 导出配置
export interface ExportConfig {
  format: ExportFormat
  quality: number
  fileName: string
  startRow: number
  endRow: number
  onePagePerRow: boolean
  exportWithDraft: boolean
}

// 字体信息
export interface FontInfo {
  name: string
  label: string
  category: string
}
