import type { ImageFit } from "@/types";
import type { Rect } from "./types";

interface Size {
  w: number;
  h: number;
}

interface FitResult {
  src: Rect; // 自然像素中的裁剪区
  dst: Rect; // 相对 box 原点(0,0)的绘制区
}

// 等比缩放、整图、居中（contain 风格）
function fitScaled(natural: Size, box: Size, scale: number): FitResult {
  const w = natural.w * scale;
  const h = natural.h * scale;
  return {
    src: { x: 0, y: 0, w: natural.w, h: natural.h },
    dst: { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h },
  };
}

// 填满框、等比、裁剪源居中（cover 风格）。scale 为 box/源 的放大系数
function fitCropped(natural: Size, box: Size, scale: number): FitResult {
  // 需要的源区域大小（自然像素）
  const srcW = Math.min(natural.w, box.w / scale);
  const srcH = Math.min(natural.h, box.h / scale);
  return {
    src: { x: (natural.w - srcW) / 2, y: (natural.h - srcH) / 2, w: srcW, h: srcH },
    dst: { x: 0, y: 0, w: box.w, h: box.h },
  };
}

// 原始尺寸、不缩放、居中（none 风格）；可见区 = min(自然, 框)，1:1 绘制
function fitNone(natural: Size, box: Size): FitResult {
  const vw = Math.min(natural.w, box.w);
  const vh = Math.min(natural.h, box.h);
  return {
    src: { x: (natural.w - vw) / 2, y: (natural.h - vh) / 2, w: vw, h: vh },
    dst: { x: (box.w - vw) / 2, y: (box.h - vh) / 2, w: vw, h: vh },
  };
}

export function computeObjectFit(fit: ImageFit, natural: Size, box: Size): FitResult {
  if (natural.w <= 0 || natural.h <= 0) {
    return { src: { x: 0, y: 0, w: 1, h: 1 }, dst: { x: 0, y: 0, w: box.w, h: box.h } };
  }
  switch (fit) {
    case "fill":
      return {
        src: { x: 0, y: 0, w: natural.w, h: natural.h },
        dst: { x: 0, y: 0, w: box.w, h: box.h },
      };
    case "contain":
      return fitScaled(natural, box, Math.min(box.w / natural.w, box.h / natural.h));
    case "cover":
      return fitCropped(natural, box, Math.max(box.w / natural.w, box.h / natural.h));
    case "none":
      return fitNone(natural, box);
    case "scale-down": {
      // 取 none 与 contain 中“渲染尺寸更小”者：图大于框时缩小(contain)，否则原尺寸(none)
      const containScale = Math.min(box.w / natural.w, box.h / natural.h);
      return containScale < 1 ? fitScaled(natural, box, containScale) : fitNone(natural, box);
    }
    default:
      return {
        src: { x: 0, y: 0, w: natural.w, h: natural.h },
        dst: { x: 0, y: 0, w: box.w, h: box.h },
      };
  }
}
