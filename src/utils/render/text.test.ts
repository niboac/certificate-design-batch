import { describe, expect, it } from "vitest";
import type { FontHandle } from "./types";
import { layoutText } from "./text";

// mock：等宽 0.5em、ascent 0.8em、descent 0.2em
const mockFont: FontHandle = {
  key: "mock",
  synthItalic: false,
  advanceWidthPx: (_ch, size) => size * 0.5,
  ascentPx: (size) => size * 0.8,
  descentPx: (size) => size * 0.2,
};

describe("layoutText", () => {
  it("单行居中：垂直在内容区居中，水平居中", () => {
    // inner 100x100，字号 20 -> 行高 lineHeight=1 -> 20px；ascent 16
    const lines = layoutText({
      text: "ab",
      font: mockFont,
      fontSizePx: 20,
      lineHeight: 1,
      letterSpacingPx: 0,
      align: "center",
      inner: { x: 0, y: 0, w: 100, h: 100 },
    });
    expect(lines).toHaveLength(1);
    // 行宽 = 2*10 = 20；居中起点 x = (100-20)/2 = 40
    expect(lines[0].glyphs[0].x).toBeCloseTo(40, 5);
    expect(lines[0].glyphs[1].x).toBeCloseTo(50, 5);
    // 块高 20，居中 top = (100-20)/2 = 40；baseline = 40 + ascent16 = 56
    expect(lines[0].baselineY).toBeCloseTo(56, 5);
  });

  it("超宽自动折行（按字符）", () => {
    // inner 宽 25，每字 10 -> 每行最多 2 字
    const lines = layoutText({
      text: "abcd",
      font: mockFont,
      fontSizePx: 20,
      lineHeight: 1,
      letterSpacingPx: 0,
      align: "left",
      inner: { x: 0, y: 0, w: 25, h: 100 },
    });
    expect(lines.map((l) => l.glyphs.map((g) => g.ch).join(""))).toEqual(["ab", "cd"]);
  });

  it("显式换行符 \\n 强制分行", () => {
    const lines = layoutText({
      text: "a\nb",
      font: mockFont,
      fontSizePx: 20,
      lineHeight: 1,
      letterSpacingPx: 0,
      align: "left",
      inner: { x: 0, y: 0, w: 100, h: 100 },
    });
    expect(lines).toHaveLength(2);
  });

  it("letter-spacing 加到每字步进", () => {
    const lines = layoutText({
      text: "ab",
      font: mockFont,
      fontSizePx: 20,
      lineHeight: 1,
      letterSpacingPx: 5,
      align: "left",
      inner: { x: 0, y: 0, w: 100, h: 100 },
    });
    // 第一字 x=0，第二字 x = 10 + 5 = 15
    expect(lines[0].glyphs[0].x).toBeCloseTo(0, 5);
    expect(lines[0].glyphs[1].x).toBeCloseTo(15, 5);
  });

  it("左对齐起点为内容区左边", () => {
    const lines = layoutText({
      text: "a",
      font: mockFont,
      fontSizePx: 20,
      lineHeight: 1,
      letterSpacingPx: 0,
      align: "left",
      inner: { x: 30, y: 0, w: 100, h: 100 },
    });
    expect(lines[0].glyphs[0].x).toBeCloseTo(30, 5);
  });
});
