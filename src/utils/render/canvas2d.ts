import type { DrawOp, ImageOp, RectOp, RGBA, TextOp } from "./types";

function cssColor(c: RGBA): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function withTransform(
  ctx: CanvasRenderingContext2D,
  op: { rotationDeg: number; cx: number; cy: number; opacity: number },
  draw: () => void,
) {
  ctx.save();
  ctx.globalAlpha = op.opacity;
  if (op.rotationDeg) {
    ctx.translate(op.cx, op.cy);
    ctx.rotate((op.rotationDeg * Math.PI) / 180);
    ctx.translate(-op.cx, -op.cy);
  }
  draw();
  ctx.restore();
}

export interface CanvasRenderInput {
  ops: DrawOp[];
  widthPx: number;
  heightPx: number;
  deviceScale: number;
  images: Map<string, HTMLImageElement>; // url -> 已加载图片
}

export function renderToCanvas(input: CanvasRenderInput): HTMLCanvasElement {
  const { ops, widthPx, heightPx, deviceScale, images } = input;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(widthPx * deviceScale);
  canvas.height = Math.round(heightPx * deviceScale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(deviceScale, deviceScale);
  ctx.textBaseline = "alphabetic";

  for (const op of ops) {
    if (op.kind === "rect") drawRect(ctx, op);
    else if (op.kind === "image") drawImage(ctx, op, images);
    else if (op.kind === "text") drawText(ctx, op);
  }
  return canvas;
}

function drawRect(ctx: CanvasRenderingContext2D, op: RectOp) {
  withTransform(ctx, op, () => {
    if (op.fill && op.fill.a > 0) {
      ctx.fillStyle = cssColor(op.fill);
      roundedPath(ctx, op.x, op.y, op.w, op.h, op.borderRadius);
      ctx.fill();
    }
    if (op.borderWidth > 0 && op.borderColor && op.borderColor.a > 0) {
      ctx.lineWidth = op.borderWidth;
      ctx.strokeStyle = cssColor(op.borderColor);
      // border-box：描边在框内侧
      const half = op.borderWidth / 2;
      roundedPath(ctx, op.x + half, op.y + half, op.w - op.borderWidth, op.h - op.borderWidth, Math.max(0, op.borderRadius - half));
      ctx.stroke();
    }
  });
}

function drawImage(ctx: CanvasRenderingContext2D, op: ImageOp, images: Map<string, HTMLImageElement>) {
  const img = images.get(op.url);
  if (!img) return;
  withTransform(ctx, op, () => {
    ctx.save();
    roundedPath(ctx, op.clip.x, op.clip.y, op.clip.w, op.clip.h, op.borderRadius);
    ctx.clip();
    ctx.drawImage(img, op.src.x, op.src.y, op.src.w, op.src.h, op.dst.x, op.dst.y, op.dst.w, op.dst.h);
    ctx.restore();
  });
}

// Canvas 2D 的 ctx.font 需要每个字体名正确引用
// 通用字体族名（serif 等）不加引号，其他字体名加引号
const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);

function quoteFontFamily(raw: string): string {
  return raw
    .split(",")
    .map((f) => {
      const trimmed = f.trim().replace(/["']/g, "");
      if (!trimmed) return "";
      if (GENERIC_FAMILIES.has(trimmed.toLowerCase())) return trimmed;
      return `"${trimmed}"`;
    })
    .filter(Boolean)
    .join(", ");
}

function drawText(ctx: CanvasRenderingContext2D, op: TextOp) {
  withTransform(ctx, op, () => {
    ctx.save();
    // overflow:hidden 裁剪
    ctx.beginPath();
    ctx.rect(op.clip.x, op.clip.y, op.clip.w, op.clip.h);
    ctx.clip();
    ctx.fillStyle = cssColor(op.color);
    const italic = op.font.synthItalic ? "italic " : "";
    const weight = op.font.fontWeight ? `${op.font.fontWeight} ` : "";
    // 使用原始 fontFamily 字符串，正确引用每个字体名让 Canvas 按 CSS fallback 链匹配系统字体
    const fam = quoteFontFamily(op.font.familyName || "sans-serif");
    ctx.font = `${italic}${weight}${op.fontSizePx}px ${fam}`;
    for (const line of op.lines) {
      for (const g of line.glyphs) {
        ctx.fillText(g.ch, g.x, line.baselineY);
      }
    }
    ctx.restore();
  });
}
