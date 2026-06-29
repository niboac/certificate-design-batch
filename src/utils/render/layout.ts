import type { CanvasElement, PaperConfig } from "@/types";
import { interpolateContent, unitToPx } from "@/utils/element";
import { parseColor } from "./color";
import { computeObjectFit } from "./objectFit";
import { layoutText } from "./text";
import { parseLength } from "./units";
import type { DrawOp, ImageOp, LayoutDeps, RectOp, TextOp } from "./types";

export async function computeLayout(
  elements: CanvasElement[],
  row: Record<string, string>,
  paper: PaperConfig,
  deps: LayoutDeps,
): Promise<DrawOp[]> {
  const paperW = unitToPx(paper.width, paper.unit);
  const paperH = unitToPx(paper.height, paper.unit);
  const ops: DrawOp[] = [];

  // 1. 纸张背景
  const bg = parseColor(paper.backgroundColor);
  ops.push({
    kind: "rect",
    x: 0,
    y: 0,
    w: paperW,
    h: paperH,
    fill: bg,
    borderWidth: 0,
    borderColor: null,
    borderRadius: 0,
    rotationDeg: 0,
    cx: paperW / 2,
    cy: paperH / 2,
    opacity: 1,
  });

  // 2. 底稿
  if (deps.draft) {
    const { resolved, opacity } = deps.draft;
    ops.push({
      kind: "image",
      dst: { x: 0, y: 0, w: paperW, h: paperH },
      src: { x: 0, y: 0, w: resolved.naturalWidth, h: resolved.naturalHeight },
      url: resolved.url,
      borderRadius: 0,
      clip: { x: 0, y: 0, w: paperW, h: paperH },
      rotationDeg: 0,
      cx: paperW / 2,
      cy: paperH / 2,
      opacity,
    });
  }

  // 3. 元素（按 zIndex 升序）
  const sorted = [...elements]
    .filter((el) => el.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const el of sorted) {
    const w = parseLength(el.width, paperW);
    const h = parseLength(el.height, paperH);
    const cx = el.x + w / 2;
    const cy = el.y + h / 2;
    const base = { rotationDeg: el.rotation, cx, cy, opacity: el.opacity };

    // 背景 + 边框
    const fill = parseColor(el.backgroundColor);
    if (fill || el.borderWidth > 0) {
      ops.push({
        kind: "rect",
        x: el.x,
        y: el.y,
        w,
        h,
        fill,
        borderWidth: el.borderWidth,
        borderColor: el.borderWidth > 0 ? parseColor(el.borderColor) : null,
        borderRadius: el.borderRadius,
        ...base,
      } as RectOp);
    }

    if (el.type === "text") {
      const inset = el.borderWidth + el.padding;
      const inner = { x: el.x + inset, y: el.y + inset, w: w - 2 * inset, h: h - 2 * inset };
      const font = await deps.fonts.resolve({
        fontFamily: el.fontFamily,
        fontWeight: el.fontWeight,
        fontStyle: el.fontStyle,
      });
      const lines = layoutText({
        text: interpolateContent(el.content, row),
        font,
        fontSizePx: el.fontSize,
        lineHeight: el.lineHeight,
        letterSpacingPx: el.letterSpacing,
        align: el.textAlign,
        inner,
      });
      const color = parseColor(el.color) ?? { r: 0, g: 0, b: 0, a: 1 };
      ops.push({
        kind: "text",
        clip: { x: el.x, y: el.y, w, h },
        lines,
        font,
        fontSizePx: el.fontSize,
        color,
        ...base,
      } as TextOp);
    } else if (el.type === "image") {
      const resolved = deps.images.get(el.id);
      if (resolved) {
        const fit = computeObjectFit(
          el.fit,
          { w: resolved.naturalWidth, h: resolved.naturalHeight },
          { w, h },
        );
        ops.push({
          kind: "image",
          dst: { x: el.x + fit.dst.x, y: el.y + fit.dst.y, w: fit.dst.w, h: fit.dst.h },
          src: fit.src,
          url: resolved.url,
          borderRadius: el.borderRadius,
          clip: { x: el.x, y: el.y, w, h },
          ...base,
        } as ImageOp);
      }
    }
  }

  return ops;
}
