import type { PaperUnit } from "@/types";

// 96 DPI 下 px -> pt
export function pxToPt(px: number): number {
  return (px * 72) / 96;
}

// 物理单位 -> pt（1in = 72pt = 25.4mm = 2.54cm = 96px）
export function unitToPt(value: number, unit: PaperUnit): number {
  if (unit === "mm") return (value / 25.4) * 72;
  if (unit === "cm") return (value / 2.54) * 72;
  return pxToPt(value); // px
}

// 把元素 width/height（number | CSS 字符串）解析为 px。
// containerPx 用于百分比与 auto 回退。
export function parseLength(value: number | string, containerPx: number): number {
  if (typeof value === "number") return value;
  const s = value.trim().toLowerCase();
  if (s === "auto" || s === "") return containerPx;
  if (s.endsWith("%")) {
    const pct = parseFloat(s);
    return Number.isNaN(pct) ? containerPx : (pct / 100) * containerPx;
  }
  const px = parseFloat(s); // 兼容 '120px' 与 '120'
  return Number.isNaN(px) ? containerPx : px;
}
