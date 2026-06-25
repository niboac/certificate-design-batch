import { degrees, PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { pxToPt } from "./units";
import type { DrawOp, ImageOp, RectOp, RGBA, TextOp } from "./types";

export interface PdfRenderInput {
  pages: DrawOp[][]; // 每页一组 ops
  widthPx: number;
  heightPx: number;
  bytesOf: (fontKey: string) => Uint8Array; // FontHandle.key -> 字体 bytes
  images: Map<string, Uint8Array>; // url -> 图片 bytes（含格式由内容判断）
}

function pdfRgb(c: RGBA) {
  return rgb(c.r, c.g, c.b);
}

// 在 pdf 坐标（左下原点）下，绕 (cx,cy) 旋转后再绘制：用 push/pop 图形状态 + 矩阵
// pdf-lib 没有暴露通用 CTM 包装，故用 page.pushOperators + 标准操作符。
// 简化方案：rect/image/text 各自支持 pdf-lib 内置 rotate（绕锚点），锚点取旋转后位置。
// 为与 canvas 对齐，这里统一用"绕元素中心旋转点"工具：把某点 p 绕中心 c 旋转 deg。
export function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export async function renderPdf(input: PdfRenderInput): Promise<Uint8Array> {
  const { pages, widthPx, heightPx, bytesOf, images } = input;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const wPt = pxToPt(widthPx);
  const hPt = pxToPt(heightPx);

  // 字体/图片缓存（整个文档共享，字体只嵌一次→子集合并）
  const fontCache = new Map<string, PDFFont>();
  const imageCache = new Map<string, PDFImage>();

  const getFont = async (key: string): Promise<PDFFont> => {
    let f = fontCache.get(key);
    if (!f) {
      f = await doc.embedFont(bytesOf(key), { subset: true });
      fontCache.set(key, f);
    }
    return f;
  };
  const getImage = async (url: string): Promise<PDFImage | null> => {
    if (imageCache.has(url)) return imageCache.get(url)!;
    const bytes = images.get(url);
    if (!bytes) return null;
    // 简单魔数判断 PNG/JPG
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    imageCache.set(url, img);
    return img;
  };

  // px(顶左,y下) -> pt(底左,y上)：x'=pxToPt(x)，y'=hPt - pxToPt(y)
  const X = (px: number) => pxToPt(px);
  const Y = (py: number) => hPt - pxToPt(py);

  for (const ops of pages) {
    const page = doc.addPage([wPt, hPt]);
    for (const op of ops) {
      if (op.kind === "rect") drawRect(page, op, X, Y);
      else if (op.kind === "image") await drawImage(page, op, getImage, X, Y);
      else if (op.kind === "text") await drawText(page, op, getFont, X, Y, hPt);
    }
  }

  return doc.save();
}

function drawRect(page: PDFPage, op: RectOp, X: (n: number) => number, Y: (n: number) => number) {
  // pdf-lib drawRectangle 以左下角为锚、rotate 绕该锚点。
  // 取目标矩形左上角在 px 空间绕中心旋转后的点作锚点。
  // 填充：整框
  if (op.fill && op.fill.a > 0) {
    const a = rotatePoint(op.x, op.y + op.h, op.cx, op.cy, op.rotationDeg);
    page.drawRectangle({
      x: X(a.x),
      y: Y(a.y),
      width: pxToPt(op.w),
      height: pxToPt(op.h),
      rotate: degrees(-op.rotationDeg),
      color: pdfRgb(op.fill),
      opacity: op.opacity * op.fill.a,
    });
  }
  // 描边：border-box，与 canvas 一致向内缩半个边宽（描边居中于路径，故路径内缩 half）
  if (op.borderWidth > 0 && op.borderColor && op.borderColor.a > 0) {
    const half = op.borderWidth / 2;
    const bw = op.w - op.borderWidth;
    const bh = op.h - op.borderWidth;
    const a = rotatePoint(op.x + half, op.y + half + bh, op.cx, op.cy, op.rotationDeg);
    page.drawRectangle({
      x: X(a.x),
      y: Y(a.y),
      width: pxToPt(bw),
      height: pxToPt(bh),
      rotate: degrees(-op.rotationDeg),
      borderWidth: pxToPt(op.borderWidth),
      borderColor: pdfRgb(op.borderColor),
      borderOpacity: op.opacity * op.borderColor.a,
    });
  }
}

async function drawImage(
  page: PDFPage,
  op: ImageOp,
  getImage: (url: string) => Promise<PDFImage | null>,
  X: (n: number) => number,
  Y: (n: number) => number,
) {
  const img = await getImage(op.url);
  if (!img) return;
  // 注：pdf-lib 不支持 drawImage 的源裁剪。cover/none 的裁剪需预裁（见说明）。
  // 这里按 dst 框绘制整图；裁剪在编排器侧用离屏 canvas 预处理为已裁剪图（Task 9）。
  const anchorPx = rotatePoint(op.dst.x, op.dst.y + op.dst.h, op.cx, op.cy, op.rotationDeg);
  page.drawImage(img, {
    x: X(anchorPx.x),
    y: Y(anchorPx.y),
    width: pxToPtSafe(op.dst.w),
    height: pxToPtSafe(op.dst.h),
    rotate: degrees(-op.rotationDeg),
    opacity: op.opacity,
  });
}

async function drawText(
  page: PDFPage,
  op: TextOp,
  getFont: (key: string) => Promise<PDFFont>,
  X: (n: number) => number,
  Y: (n: number) => number,
  _hPt: number,
) {
  const font = await getFont(op.font.key);
  const sizePt = pxToPtSafe(op.fontSizePx);
  for (const line of op.lines) {
    for (const g of line.glyphs) {
      const anchor = rotatePoint(g.x, line.baselineY, op.cx, op.cy, op.rotationDeg);
      page.drawText(g.ch, {
        x: X(anchor.x),
        y: Y(anchor.y),
        size: sizePt,
        font,
        color: pdfRgb(op.color),
        opacity: op.opacity * op.color.a,
        rotate: degrees(-op.rotationDeg),
      });
    }
  }
}

function pxToPtSafe(px: number): number {
  return pxToPt(px);
}

// 字体不可用时的兜底：每页一张整页 PNG
export async function renderRasterPdf(
  pagePngs: Uint8Array[],
  widthPx: number,
  heightPx: number,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const wPt = pxToPt(widthPx);
  const hPt = pxToPt(heightPx);
  for (const png of pagePngs) {
    const page = doc.addPage([wPt, hPt]);
    const img = await doc.embedPng(png);
    page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
  }
  return doc.save();
}
