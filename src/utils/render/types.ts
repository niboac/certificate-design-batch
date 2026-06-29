import type { FontStyle, FontWeight } from "@/types";

// 颜色，分量 0..1
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 字体查询条件
export interface FontStyleQuery {
  fontFamily: string;
  fontWeight: FontWeight;
  fontStyle: FontStyle;
}

// 字体度量句柄（由 fonts.ts 用 fontkit 实现，测试可 mock）
export interface FontHandle {
  // 后端据此挑选绘制字体（pdf 嵌入字体 / canvas FontFace）
  key: string;
  // 原始字体家族名（canvas 渲染用，如 "Microsoft YaHei"）
  familyName: string;
  // 单字符在给定字号下的步进宽度（px）
  advanceWidthPx(ch: string, fontSizePx: number): number;
  // 给定字号下的上行高（px，正数）
  ascentPx(fontSizePx: number): number;
  // 给定字号下的下行深（px，正数）
  descentPx(fontSizePx: number): number;
  // 是否合成斜体（无 Italic 字重时由后端做 skew）
  synthItalic: boolean;
}

export interface FontProvider {
  resolve(query: FontStyleQuery): FontHandle;
}

// 预解析后的图片
export interface ResolvedImage {
  url: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface GlyphPlacement {
  ch: string;
  x: number; // 绝对 x（paper-px）
}

export interface TextLine {
  glyphs: GlyphPlacement[];
  baselineY: number; // 绝对 baseline y（paper-px）
  width: number;
}

export interface BaseOp {
  rotationDeg: number;
  cx: number; // 旋转中心
  cy: number;
  opacity: number;
}

export interface RectOp extends BaseOp {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: RGBA | null;
  borderWidth: number;
  borderColor: RGBA | null;
  borderRadius: number;
}

export interface ImageOp extends BaseOp {
  kind: "image";
  dst: Rect; // 目标框（paper-px，绝对）
  src: Rect; // 源裁剪（自然像素）
  url: string;
  borderRadius: number;
  clip: Rect; // 裁剪到的边框框（= 元素框）
}

export interface TextOp extends BaseOp {
  kind: "text";
  clip: Rect; // overflow:hidden 裁剪框
  lines: TextLine[];
  font: FontHandle;
  fontSizePx: number;
  color: RGBA;
}

export type DrawOp = RectOp | ImageOp | TextOp;

// computeLayout 的依赖
export interface LayoutDeps {
  fonts: FontProvider;
  images: Map<string, ResolvedImage>; // key = element.id
  draft?: { resolved: ResolvedImage; opacity: number } | null;
}
