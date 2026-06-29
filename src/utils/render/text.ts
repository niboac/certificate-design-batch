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
  isHeightAuto?: boolean;
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
  let lastBreak = -1; // cur 中最近一个空格的索引（可断点）

  const widthOf = (chars: string[]): number =>
    chars.reduce((s, c) => s + advance(font, c, sizePx, lsPx), 0);
  const pushLine = (chars: string[]): void => {
    lines.push({ chars, width: widthOf(chars) });
  };

  for (const ch of text) {
    const isSpace = ch === " ";
    // 行首折叠空格：换行后开头的空格丢弃（与 CSS 折行一致，避免空白行）
    if (isSpace && cur.length === 0) continue;
    const w = advance(font, ch, sizePx, lsPx);
    if (curW + w > maxW && cur.length > 0) {
      if (lastBreak >= 0) {
        // 在最近空格处断行：空格本身折叠丢弃，前后分到两行
        const before = cur.slice(0, lastBreak);
        const rest = cur.slice(lastBreak + 1);
        pushLine(before);
        cur = rest;
        curW = widthOf(rest);
      } else {
        // 无可断空格：按字符硬断
        pushLine(cur);
        cur = [];
        curW = 0;
      }
      lastBreak = -1;
      // 断行后当前若为空格且新行已空，折叠丢弃
      if (isSpace && cur.length === 0) continue;
    }
    if (isSpace) lastBreak = cur.length;
    cur.push(ch);
    curW += w;
  }
  pushLine(cur);
  return lines;
}

export function layoutText(params: LayoutTextParams): TextLine[] {
  const { text, font, fontSizePx, lineHeight, letterSpacingPx, align, inner, isHeightAuto } = params;
  const lineHeightPx = lineHeight * fontSizePx;

  // 先按显式换行符切，再各自按宽度折行
  const raw: RawLine[] = [];
  for (const para of text.split("\n")) {
    raw.push(...wrapSegment(para, font, fontSizePx, letterSpacingPx, inner.w));
  }

  // 垂直居中整块
  const blockH = raw.length * lineHeightPx;
  const ascent = font.ascentPx(fontSizePx);
  const descent = font.descentPx(fontSizePx);
  // 行内半行距：CSS 行框把 (lineHeight - 字体高) 的一半放在基线之上
  const halfLeading = (lineHeightPx - (ascent + descent)) / 2;
  let top: number;
  if (isHeightAuto) {
    top = inner.y;
  } else {
    top = inner.y + (inner.h - blockH) / 2;
  }

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
      baselineY: top + i * lineHeightPx + halfLeading + ascent,
      width: line.width,
    });
  });

  return out;
}
