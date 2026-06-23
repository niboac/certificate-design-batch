import type {
  CanvasElement,
  ImageElement,
  PaperConfig,
  TextElement,
} from "@/types";

// 生成唯一 ID
export function generateId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// 创建默认文本元素
export function createTextElement(
  partial: Partial<Omit<TextElement, "id" | "type">> = {},
): TextElement {
  const base: TextElement = {
    id: generateId(),
    type: "text",
    x: 100,
    y: 100,
    width: 200,
    height: 60,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    visible: true,
    locked: false,
    content: "点击编辑文本",
    fontFamily: "Microsoft YaHei",
    fontSize: 24,
    color: "#1f1f1f",
    fontWeight: "normal",
    fontStyle: "normal",
    textAlign: "left",
    lineHeight: 1.4,
    letterSpacing: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "#d9d9d9",
    borderRadius: 0,
    padding: 4,
  };
  return { ...base, ...partial };
}

// 创建默认图片元素
export function createImageElement(
  partial: Partial<Omit<ImageElement, "id" | "type">> = {},
): ImageElement {
  const base: ImageElement = {
    id: generateId(),
    type: "image",
    x: 100,
    y: 100,
    width: 160,
    height: 160,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    visible: true,
    locked: false,
    src: "",
    fit: "cover",
    backgroundColor: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "#d9d9d9",
  };
  return { ...base, ...partial };
}

// 默认稿纸配置（A4 竖向）
export function createDefaultPaper(): PaperConfig {
  return {
    width: 210,
    height: 297,
    unit: "mm",
    orientation: "portrait",
    backgroundColor: "#ffffff",
    showGrid: true,
    gridSize: 5,
  };
}

// 将变量占位符 {{col}} 替换为实际数据
export function interpolateContent(
  template: string,
  row: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    return row[key.trim()] ?? "";
  });
}

// 单位换算为像素（基于 96 DPI）
export function unitToPx(value: number, unit: "mm" | "px" | "cm"): number {
  if (unit === "px") return value;
  if (unit === "mm") return (value / 25.4) * 96;
  return (value / 2.54) * 96;
}

// 像素换算为目标单位
export function pxToUnit(px: number, unit: "mm" | "px" | "cm"): number {
  if (unit === "px") return px;
  if (unit === "mm") return (px / 96) * 25.4;
  return (px / 96) * 2.54;
}

// 根据 zIndex 排序元素
export function sortByZIndex(elements: CanvasElement[]): CanvasElement[] {
  return [...elements].sort((a, b) => a.zIndex - b.zIndex);
}
