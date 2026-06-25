import type { TextAlign } from "@/types";
import type { FontHandle, Rect, TextLine } from "./types";

interface LayoutTextParams {
  text: string;
  font: FontHandle;
  fontSizePx: number;
  lineHeight: number; // 无单位倍数
  letterSpacingPx: number;
  align: TextAlign;
  inner: Rect; // 内容区（已扣除 border + padding），绝对坐标
}

interface RawLine {
  chars: string[];
  width: number;
}

// 每字步进 = advance + letterSpacing（CSS 在每字后都加）
function advance(font: FontHandle, ch: string, sizePx: number, lsPx: number): number {
  return font.advanceWidthPx(ch, sizePx) + lsPx;
}

// 把一段（无换行符）按宽度折成多行，逐字符（CJK 友好；空格作为可断点优先）
function wrapSegment(
  text: string,
  font: FontHandle,
  sizePx: number,
  lsPx: number,
  maxW: number,
): RawLine[] {
  const lines: RawLine[] = [];
  let cur: string[] = [];
  let curW = 0;
  let lastBreak = -1; // cur 中最近一个空格后的可断位置

  const push = () => {
    lines.push({ chars: cur, width: curW });
    cur = [];
    curW = 0;
    lastBreak = -1;
  };

  for (const ch of text) {
    const w = advance(font, ch, sizePx, lsPx);
    if (curW + w > maxW && cur.length > 0) {
      if (lastBreak >= 0 && lastBreak < cur.length - 1) {
        // 在最近空格处断行，余下挪到下一行
        const rest = cur.slice(lastBreak + 1);
        cur = cur.slice(0, lastBreak + 1);
        curW = cur.reduce((s, c) => s + advance(font, c, sizePx, lsPx), 0);
        push();
        cur = rest;
        curW = rest.reduce((s, c) => s + advance(font, c, sizePx, lsPx), 0);
      } else {
        push();
      }
    }
    if (ch === " ") lastBreak = cur.length;
    cur.push(ch);
    curW += w;
  }
  push();
  return lines;
}

export function layoutText(params: LayoutTextParams): TextLine[] {
  const { text, font, fontSizePx, lineHeight, letterSpacingPx, align, inner } = params;
  const lineHeightPx = lineHeight * fontSizePx;

  // 先按显式换行符切，再各自按宽度折行
  const raw: RawLine[] = [];
  for (const para of text.split("\n")) {
    raw.push(...wrapSegment(para, font, fontSizePx, letterSpacingPx, inner.w));
  }

  // 垂直居中整块
  const blockH = raw.length * lineHeightPx;
  const ascent = font.ascentPx(fontSizePx);
  let top = inner.y + (inner.h - blockH) / 2;
  if (top < inner.y) top = inner.y; // 溢出时顶对齐（overflow:hidden 裁剪）

  const out: TextLine[] = [];
  raw.forEach((line, i) => {
    let startX = inner.x;
    if (align === "center") startX = inner.x + (inner.w - line.width) / 2;
    else if (align === "right") startX = inner.x + (inner.w - line.width);

    const glyphs: { ch: string; x: number }[] = [];
    let x = startX;
    for (const ch of line.chars) {
      glyphs.push({ ch, x });
      x += advance(font, ch, fontSizePx, letterSpacingPx);
    }
    out.push({
      glyphs,
      baselineY: top + i * lineHeightPx + ascent,
      width: line.width,
    });
  });

  return out;
}
