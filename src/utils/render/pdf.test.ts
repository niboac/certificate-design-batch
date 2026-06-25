import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fontkit from "fontkit";
import type { DrawOp, FontHandle } from "./types";
import { renderPdf, rotatePoint } from "./pdf";

// rotatePoint 是纯函数，确定性测试（无需字体）
describe("rotatePoint", () => {
  it("不旋转返回原点", () => {
    expect(rotatePoint(10, 20, 0, 0, 0)).toEqual({ x: 10, y: 20 });
  });
  it("绕原点旋转 90°：(10,0) -> (0,10)", () => {
    const p = rotatePoint(10, 0, 0, 0, 90);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(10, 5);
  });
  it("绕 (10,10) 旋转 180°：(12,10) -> (8,10)", () => {
    const p = rotatePoint(12, 10, 10, 10, 180);
    expect(p.x).toBeCloseTo(8, 5);
    expect(p.y).toBeCloseTo(10, 5);
  });
});

// PDF 生成冒烟测试：从 CDN 取 SC 子集字体（缓存到 tmp）；离线则软跳过（早返回，不失败）
const FONT_URL =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf";
const CACHE = join(tmpdir(), "noto-sans-sc-subset-test.otf");
let sansBytes: Uint8Array | null = null;

beforeAll(async () => {
  try {
    if (existsSync(CACHE)) {
      sansBytes = new Uint8Array(readFileSync(CACHE));
      return;
    }
    const res = await fetch(FONT_URL);
    if (!res.ok) return;
    const buf = new Uint8Array(await res.arrayBuffer());
    writeFileSync(CACHE, buf);
    sansBytes = buf;
  } catch {
    sansBytes = null; // 离线 -> 软跳过
  }
}, 60000);

describe("renderPdf", () => {
  it("生成含两页的 PDF 字节，文本可嵌入（需联网取字体；离线软跳过）", async () => {
    if (!sansBytes) return; // 离线软跳过，不失败
    const kit = (fontkit as any).create(sansBytes);
    const handle: FontHandle = {
      key: "render_sans-Regular",
      synthItalic: false,
      advanceWidthPx: (ch, s) => {
        const g = kit.glyphForCodePoint(ch.codePointAt(0) ?? 32);
        return (g.advanceWidth / kit.unitsPerEm) * s;
      },
      ascentPx: (s) => (kit.ascent / kit.unitsPerEm) * s,
      descentPx: (s) => (Math.abs(kit.descent) / kit.unitsPerEm) * s,
    };
    const ops: DrawOp[] = [
      { kind: "rect", x: 0, y: 0, w: 200, h: 100, fill: { r: 1, g: 1, b: 1, a: 1 }, borderWidth: 0, borderColor: null, borderRadius: 0, rotationDeg: 0, cx: 100, cy: 50, opacity: 1 },
      { kind: "text", clip: { x: 0, y: 0, w: 200, h: 100 }, lines: [{ glyphs: [{ ch: "证", x: 10 }, { ch: "书", x: 30 }], baselineY: 40, width: 40 }], font: handle, fontSizePx: 20, color: { r: 0, g: 0, b: 0, a: 1 }, rotationDeg: 0, cx: 100, cy: 50, opacity: 1 },
    ];
    const bytes = await renderPdf({ pages: [ops, ops], widthPx: 200, heightPx: 100, bytesOf: () => sansBytes!, images: new Map() });
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
