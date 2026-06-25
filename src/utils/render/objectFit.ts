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
      return fitCropped(natural, box, 1);
    case "scale-down": {
      const contain = fitScaled(natural, box, Math.min(box.w / natural.w, box.h / natural.h));
      const none = fitCropped(natural, box, 1);
      // 取实际显示面积更小者
      const containArea = contain.dst.w * contain.dst.h;
      const noneArea = none.dst.w * none.dst.h;
      return containArea <= noneArea ? contain : none;
    }
    default:
      return {
        src: { x: 0, y: 0, w: natural.w, h: natural.h },
        dst: { x: 0, y: 0, w: box.w, h: box.h },
      };
  }
}
