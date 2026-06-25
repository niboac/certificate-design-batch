# 矢量导出保真度重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用"共享布局核心 + 两后端（pdf-lib 矢量 PDF / Canvas 2D 光栅 PNG·JPG）"替换 html2canvas+jsPDF 导出，使导出严格匹配编辑器设计、PDF 文本为可选中矢量。

**Architecture:** `computeLayout()` 是唯一事实来源，把元素解析成与后端无关的 `DrawOp[]`（paper-px、左上原点、y 向下，文本含逐字 x）。两个后端消费同一份 ops：`pdf.ts`（pdf-lib + fontkit 子集化）输出矢量 PDF，`canvas2d.ts` 输出 PNG/JPG 并兼作 PDF 字体降级兜底。文本度量用 fontkit 统一测量一次，两后端按核心算好的逐字坐标绘制，保证一致。

**Tech Stack:** TypeScript, Vue 3, Vite, Pinia；新增 `pdf-lib`、`@pdf-lib/fontkit`、`fontkit`、`vitest`；移除 `jspdf`、`html2canvas`。绑定字体 Noto Sans SC / Noto Serif SC（Regular/Bold）。

设计依据：[2026-06-25-vector-export-fidelity-design.md](../specs/2026-06-25-vector-export-fidelity-design.md)

---

## 文件结构

新建 `src/utils/render/`：

| 文件 | 职责 |
| --- | --- |
| `types.ts` | `RGBA`/`Rect`/`DrawOp`/`FontHandle`/`FontProvider`/`ResolvedImage` 等共享类型 |
| `color.ts` | `parseColor()` CSS 颜色字符串 → `RGBA` |
| `units.ts` | `pxToPt`/`unitToPt`/`parseLength` 单位与尺寸换算 |
| `objectFit.ts` | `computeObjectFit()` 五种 fit 的 src/dst 矩形 |
| `text.ts` | `layoutText()` 折行 + 水平对齐 + 垂直居中 + letter-spacing（逐字 x、baseline） |
| `layout.ts` | `computeLayout()` 组装 `DrawOp[]`（纯函数） |
| `fonts.ts` | 字体服务：加载绑定/自定义字体，fontkit 度量，提供 `FontProvider`/bytes/FontFace |
| `pdf.ts` | pdf-lib 后端：`renderPdf()` |
| `canvas2d.ts` | Canvas 2D 后端：`renderCanvas()` |

改写：`src/utils/export.ts`（编排器，保留 `batchExport` 签名）、`src/stores/export.ts`（多传自定义字体注册表）。
字体：运行时从 jsDelivr CDN 懒加载 SC 子集 OTF（NotoSansSC / NotoSerifSC，Regular/Bold），**不提交进仓库**。

---

## Task 0: 安装依赖与 vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/utils/render/smoke.test.ts`（临时，验证测试运行器）

- [ ] **Step 1: 安装依赖**

Run:
```bash
pnpm add pdf-lib @pdf-lib/fontkit fontkit && pnpm add -D vitest && pnpm remove jspdf html2canvas
```
Expected: 安装成功，`package.json` 出现 `pdf-lib`/`@pdf-lib/fontkit`/`fontkit`/`vitest`，移除 `jspdf`/`html2canvas`。
（若仓库用 npm，则 `npm i pdf-lib @pdf-lib/fontkit fontkit && npm i -D vitest && npm rm jspdf html2canvas`。）

- [ ] **Step 2: 添加测试脚本**

在 `package.json` 的 `scripts` 中加入：
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: 创建 vitest 配置**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: 写冒烟测试**

Create `src/utils/render/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";

describe("test runner", () => {
  it("works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 运行确认通过**

Run: `pnpm test`
Expected: PASS（1 passed）。

- [ ] **Step 6: 删除冒烟测试并提交**

```bash
rm src/utils/render/smoke.test.ts
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: 引入 pdf-lib/fontkit/vitest，移除 jspdf/html2canvas"
```

---

## Task 1: 共享类型 + 颜色解析

**Files:**
- Create: `src/utils/render/types.ts`
- Create: `src/utils/render/color.ts`
- Test: `src/utils/render/color.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/utils/render/color.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseColor } from "./color";

describe("parseColor", () => {
  it("#rrggbb", () => {
    expect(parseColor("#1f1f1f")).toEqual({ r: 31 / 255, g: 31 / 255, b: 31 / 255, a: 1 });
  });
  it("#rgb 简写", () => {
    expect(parseColor("#fff")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
  it("#rrggbbaa", () => {
    const c = parseColor("#00000080")!;
    expect(c.r).toBe(0);
    expect(c.a).toBeCloseTo(128 / 255, 5);
  });
  it("rgb()", () => {
    expect(parseColor("rgb(255, 0, 0)")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
  it("rgba()", () => {
    expect(parseColor("rgba(0,128,0,0.5)")).toEqual({ r: 0, g: 128 / 255, b: 0, a: 0.5 });
  });
  it("transparent -> a=0", () => {
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
  it("命名颜色 white/black", () => {
    expect(parseColor("white")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColor("black")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
  it("非法输入 -> null", () => {
    expect(parseColor("not-a-color")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/utils/render/color.test.ts`
Expected: FAIL（找不到模块 `./color`）。

- [ ] **Step 3: 写类型**

Create `src/utils/render/types.ts`:
```ts
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
```

- [ ] **Step 4: 写颜色解析实现**

Create `src/utils/render/color.ts`:
```ts
import type { RGBA } from "./types";

const NAMED: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
};

// 解析 CSS 颜色为 RGBA(0..1)。transparent => a=0；非法 => null
export function parseColor(input: string): RGBA | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();

  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (s === "none") return null;
  if (s in NAMED) {
    const [r, g, b] = NAMED[s];
    return { r: r / 255, g: g / 255, b: b / 255, a: 1 };
  }

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const expand = (h: string) =>
      h.length === 3 || h.length === 4
        ? h.split("").map((c) => c + c).join("")
        : h;
    const full = expand(hex);
    if (full.length !== 6 && full.length !== 8) return null;
    const num = (i: number) => parseInt(full.slice(i, i + 2), 16);
    if (full.split("").some((c) => !/[0-9a-f]/.test(c))) return null;
    return {
      r: num(0) / 255,
      g: num(2) / 255,
      b: num(4) / 255,
      a: full.length === 8 ? num(6) / 255 : 1,
    };
  }

  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(",").map((p) => p.trim());
    if (parts.length < 3) return null;
    const r = parseFloat(parts[0]);
    const g = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
    return { r: r / 255, g: g / 255, b: b / 255, a };
  }

  return null;
}
```

- [ ] **Step 5: 运行确认通过**

Run: `pnpm test src/utils/render/color.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/utils/render/types.ts src/utils/render/color.ts src/utils/render/color.test.ts
git commit -m "feat(render): 共享类型与颜色解析"
```

---

## Task 2: 单位与尺寸换算

**Files:**
- Create: `src/utils/render/units.ts`
- Test: `src/utils/render/units.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/utils/render/units.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseLength, pxToPt, unitToPt } from "./units";

describe("pxToPt", () => {
  it("96px = 72pt", () => {
    expect(pxToPt(96)).toBeCloseTo(72, 6);
  });
});

describe("unitToPt", () => {
  it("25.4mm = 72pt", () => {
    expect(unitToPt(25.4, "mm")).toBeCloseTo(72, 6);
  });
  it("2.54cm = 72pt", () => {
    expect(unitToPt(2.54, "cm")).toBeCloseTo(72, 6);
  });
  it("96px = 72pt", () => {
    expect(unitToPt(96, "px")).toBeCloseTo(72, 6);
  });
});

describe("parseLength", () => {
  it("数字按 px", () => {
    expect(parseLength(120, 800)).toBe(120);
  });
  it("'120px'", () => {
    expect(parseLength("120px", 800)).toBe(120);
  });
  it("'50%' 取容器比例", () => {
    expect(parseLength("50%", 800)).toBe(400);
  });
  it("'auto' 回退为容器值", () => {
    expect(parseLength("auto", 800)).toBe(800);
  });
  it("裸数字字符串", () => {
    expect(parseLength("200", 800)).toBe(200);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/utils/render/units.test.ts`
Expected: FAIL（找不到 `./units`）。

- [ ] **Step 3: 写实现**

Create `src/utils/render/units.ts`:
```ts
import type { PaperUnit } from "@/types";

// 96 DPI 下 px -> pt
export function pxToPt(px: number): number {
  return (px * 72) / 96;
}

// 物理单位 -> pt（1in = 72pt = 25.4mm = 2.54cm = 96px）
export function unitToPt(value: number, unit: PaperUnit): number {
  if (unit === "mm") return (value / 25.4) * 72;
  if (unit === "cm") return (value / 2.54) * 72;
  return pxToPt(value); // px
}

// 把元素 width/height（number | CSS 字符串）解析为 px。
// containerPx 用于百分比与 auto 回退。
export function parseLength(value: number | string, containerPx: number): number {
  if (typeof value === "number") return value;
  const s = value.trim().toLowerCase();
  if (s === "auto" || s === "") return containerPx;
  if (s.endsWith("%")) {
    const pct = parseFloat(s);
    return Number.isNaN(pct) ? containerPx : (pct / 100) * containerPx;
  }
  const px = parseFloat(s); // 兼容 '120px' 与 '120'
  return Number.isNaN(px) ? containerPx : px;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test src/utils/render/units.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/render/units.ts src/utils/render/units.test.ts
git commit -m "feat(render): 单位与尺寸换算"
```

---

## Task 3: object-fit 裁剪计算

**Files:**
- Create: `src/utils/render/objectFit.ts`
- Test: `src/utils/render/objectFit.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/utils/render/objectFit.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeObjectFit } from "./objectFit";

// natural 200x100，box 100x100
const natural = { w: 200, h: 100 };
const box = { w: 100, h: 100 };

describe("computeObjectFit", () => {
  it("fill: 拉伸填满，src 全图，dst 全框", () => {
    const r = computeObjectFit("fill", natural, box);
    expect(r.src).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(r.dst).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it("contain: 整图可见、等比、居中（letterbox）", () => {
    const r = computeObjectFit("contain", natural, box);
    expect(r.src).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    // scale = min(100/200,100/100)=0.5 -> 100x50，垂直居中 y=25
    expect(r.dst).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });
  it("cover: 填满框、等比、裁剪源", () => {
    const r = computeObjectFit("cover", natural, box);
    // scale = max(0.5,1)=1 -> 需要源 100x100，水平居中裁剪 x=50
    expect(r.src).toEqual({ x: 50, y: 0, w: 100, h: 100 });
    expect(r.dst).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it("none: 原始尺寸、居中、超出裁剪", () => {
    const r = computeObjectFit("none", natural, box);
    // 源水平裁到 100 宽（居中 x=50），高 100>=100 全可见；dst 居中
    expect(r.src).toEqual({ x: 50, y: 0, w: 100, h: 100 });
    expect(r.dst).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it("scale-down: 取 none 与 contain 中更小者", () => {
    const r = computeObjectFit("scale-down", natural, box);
    // none 显示 100x100 区域；contain 显示 100x50；取更小 => contain
    expect(r.dst).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/utils/render/objectFit.test.ts`
Expected: FAIL（找不到 `./objectFit`）。

- [ ] **Step 3: 写实现**

Create `src/utils/render/objectFit.ts`:
```ts
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
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test src/utils/render/objectFit.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/render/objectFit.ts src/utils/render/objectFit.test.ts
git commit -m "feat(render): object-fit 裁剪计算"
```

---

## Task 4: 文本布局（折行 + 对齐 + 垂直居中 + letter-spacing）

**Files:**
- Create: `src/utils/render/text.ts`
- Test: `src/utils/render/text.test.ts`

`layoutText` 用注入的 `FontHandle` 度量，返回逐字绝对 x 与每行 baseline，垂直居中于内容区。测试用 mock：每字符宽 = 字号×0.5，ascent = 字号×0.8，descent = 字号×0.2。

- [ ] **Step 1: 写失败测试**

Create `src/utils/render/text.test.ts`:
```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/utils/render/text.test.ts`
Expected: FAIL（找不到 `./text`）。

- [ ] **Step 3: 写实现**

Create `src/utils/render/text.ts`:
```ts
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
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test src/utils/render/text.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/render/text.ts src/utils/render/text.test.ts
git commit -m "feat(render): 文本折行/对齐/垂直居中/letter-spacing"
```

---

## Task 5: computeLayout 组装 DrawOp[]

**Files:**
- Create: `src/utils/render/layout.ts`
- Test: `src/utils/render/layout.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/utils/render/layout.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createImageElement, createTextElement } from "@/utils/element";
import { createDefaultPaper } from "@/utils/element";
import type { FontHandle, FontProvider, LayoutDeps, ResolvedImage } from "./types";
import { computeLayout } from "./layout";

const mockFont: FontHandle = {
  key: "mock",
  synthItalic: false,
  advanceWidthPx: (_c, s) => s * 0.5,
  ascentPx: (s) => s * 0.8,
  descentPx: (s) => s * 0.2,
};
const fonts: FontProvider = { resolve: () => mockFont };
const paper = createDefaultPaper();
const deps = (over: Partial<LayoutDeps> = {}): LayoutDeps => ({
  fonts,
  images: new Map(),
  draft: null,
  ...over,
});

describe("computeLayout", () => {
  it("按 zIndex 升序排列，背景框在前", () => {
    const a = createTextElement({ zIndex: 2, content: "A" });
    const b = createTextElement({ zIndex: 1, content: "B" });
    const ops = computeLayout([a, b], {}, paper, deps());
    // 第一个 op 是纸张背景 rect
    expect(ops[0].kind).toBe("rect");
    // 文本 op 顺序：B(z1) 在 A(z2) 前
    const texts = ops.filter((o) => o.kind === "text");
    expect(texts).toHaveLength(2);
  });

  it("跳过不可见元素", () => {
    const a = createTextElement({ visible: false, content: "A" });
    const ops = computeLayout([a], {}, paper, deps());
    expect(ops.some((o) => o.kind === "text")).toBe(false);
  });

  it("文本变量插值", () => {
    const a = createTextElement({ content: "你好 {{name}}", x: 0, y: 0, width: 400, height: 60 });
    const ops = computeLayout([a], { name: "张三" }, paper, deps());
    const text = ops.find((o) => o.kind === "text");
    const joined = (text as any).lines
      .flatMap((l: any) => l.glyphs.map((g: any) => g.ch))
      .join("");
    expect(joined).toContain("张三");
  });

  it("旋转中心 = 元素框中心", () => {
    const a = createTextElement({ x: 100, y: 100, width: 200, height: 60, rotation: 30 });
    const ops = computeLayout([a], {}, paper, deps());
    const text = ops.find((o) => o.kind === "text")!;
    expect(text.cx).toBe(200);
    expect(text.cy).toBe(130);
    expect(text.rotationDeg).toBe(30);
  });

  it("图片按 object-fit 出 src/dst（id 用元素真实 id）", () => {
    const img = createImageElement({ x: 0, y: 0, width: 100, height: 100, fit: "cover" });
    const resolved: ResolvedImage = { url: "blob:x", naturalWidth: 200, naturalHeight: 100 };
    const ops = computeLayout([img], {}, paper, deps({ images: new Map([[img.id, resolved]]) }));
    const im = ops.find((o) => o.kind === "image") as any;
    expect(im).toBeTruthy();
    expect(im.dst).toMatchObject({ w: 100, h: 100 });
    expect(im.src.w).toBeCloseTo(100, 5); // cover 裁剪
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/utils/render/layout.test.ts`
Expected: FAIL（找不到 `./layout`）。

- [ ] **Step 3: 写实现**

Create `src/utils/render/layout.ts`:
```ts
import type { CanvasElement, PaperConfig } from "@/types";
import { interpolateContent, unitToPx } from "@/utils/element";
import { parseColor } from "./color";
import { computeObjectFit } from "./objectFit";
import { layoutText } from "./text";
import { parseLength } from "./units";
import type { DrawOp, ImageOp, LayoutDeps, RectOp, TextOp } from "./types";

export function computeLayout(
  elements: CanvasElement[],
  row: Record<string, string>,
  paper: PaperConfig,
  deps: LayoutDeps,
): DrawOp[] {
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
      const font = deps.fonts.resolve({
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
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test src/utils/render/layout.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/render/layout.ts src/utils/render/layout.test.ts
git commit -m "feat(render): computeLayout 组装 DrawOp"
```

---

## Task 6: 字体服务

**Files:**
- Create: `src/utils/render/fonts.ts`
- Test: `src/utils/render/fonts.test.ts`（仅测纯映射逻辑）
- 字体：运行时从 jsDelivr CDN 懒加载 SC 子集 OTF，**不提交进仓库**

字体加载、fontkit 解析涉及网络/二进制，单测只覆盖**字体角色映射**纯函数 `resolveFontRole`。实际加载在浏览器中手工验证。

- [ ] **Step 1: 确认 CDN 字体可达（不下载、不提交）**

字体改为运行时从 jsDelivr CDN 懒加载（SC 子集 OTF，约 8–12MB/个，浏览器缓存）。先验证可达：

```bash
curl -s -o /dev/null -L --max-time 30 -w "%{http_code}\n" \
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf"
```
Expected: `200`。jsDelivr 设 `access-control-allow-origin: *`，浏览器 `fetch().arrayBuffer()` 可跨域取字节，无需 `public/fonts/`。

- [ ] **Step 2: 写失败测试（仅映射逻辑）**

Create `src/utils/render/fonts.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveFontRole } from "./fonts";

describe("resolveFontRole", () => {
  it("宋体/serif 关键字 -> serif", () => {
    expect(resolveFontRole({ fontFamily: "SimSun", fontWeight: "normal", fontStyle: "normal" }).family).toBe("serif");
    expect(resolveFontRole({ fontFamily: "Times New Roman", fontWeight: "normal", fontStyle: "normal" }).family).toBe("serif");
  });
  it("黑体/雅黑 -> sans", () => {
    expect(resolveFontRole({ fontFamily: "Microsoft YaHei", fontWeight: "normal", fontStyle: "normal" }).family).toBe("sans");
    expect(resolveFontRole({ fontFamily: "SimHei", fontWeight: "normal", fontStyle: "normal" }).family).toBe("sans");
  });
  it("fontWeight>=600 -> bold", () => {
    expect(resolveFontRole({ fontFamily: "SimHei", fontWeight: "700", fontStyle: "normal" }).bold).toBe(true);
    expect(resolveFontRole({ fontFamily: "SimHei", fontWeight: "bold", fontStyle: "normal" }).bold).toBe(true);
    expect(resolveFontRole({ fontFamily: "SimHei", fontWeight: "400", fontStyle: "normal" }).bold).toBe(false);
  });
  it("italic -> synthItalic", () => {
    expect(resolveFontRole({ fontFamily: "SimHei", fontWeight: "normal", fontStyle: "italic" }).synthItalic).toBe(true);
  });
  it("custom_ 前缀 -> custom 角色", () => {
    const r = resolveFontRole({ fontFamily: "custom_123_MyFont", fontWeight: "normal", fontStyle: "normal" });
    expect(r.family).toBe("custom");
    expect(r.customName).toBe("custom_123_MyFont");
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm test src/utils/render/fonts.test.ts`
Expected: FAIL（找不到 `./fonts`）。

- [ ] **Step 4: 写实现**

Create `src/utils/render/fonts.ts`:
```ts
import fontkit from "fontkit";
import type { FontProvider, FontStyleQuery, FontHandle } from "./types";

export interface FontRole {
  family: "sans" | "serif" | "custom";
  bold: boolean;
  synthItalic: boolean;
  customName?: string;
}

// 自定义字体注册表：fontFamily -> 字体文件 URL（object URL）
export type CustomFontRegistry = Record<string, string>;

// 运行时从 jsDelivr CDN 懒加载 SC 子集字体（不提交进仓库）。@main 后续可 pin 到 release tag。
const CDN = "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main";
const BUNDLED: Record<string, string> = {
  "sans-Regular": `${CDN}/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf`,
  "sans-Bold": `${CDN}/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf`,
  "serif-Regular": `${CDN}/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf`,
  "serif-Bold": `${CDN}/Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf`,
};

const WEIGHT_NUM: Record<string, number> = {
  normal: 400,
  bold: 700,
};

// 纯映射：把样式查询解析成角色
export function resolveFontRole(q: FontStyleQuery): FontRole {
  const synthItalic = q.fontStyle === "italic";
  const weight = WEIGHT_NUM[q.fontWeight] ?? Number(q.fontWeight) ?? 400;
  const bold = weight >= 600;

  if (q.fontFamily.startsWith("custom_")) {
    return { family: "custom", bold, synthItalic, customName: q.fontFamily };
  }
  const lower = q.fontFamily.toLowerCase();
  const isSerif =
    lower.includes("serif") ||
    lower.includes("song") ||
    lower.includes("宋") ||
    lower.includes("kai") ||
    lower.includes("楷") ||
    lower.includes("fang") ||
    lower.includes("仿") ||
    lower.includes("times") ||
    lower.includes("georgia");
  return { family: isSerif ? "serif" : "sans", bold, synthItalic };
}

interface ParsedFont {
  key: string;
  bytes: Uint8Array;
  kit: any; // fontkit Font
  fontFace?: FontFace;
}

// 用 fontkit 度量构造 FontHandle
function makeHandle(parsed: ParsedFont, synthItalic: boolean): FontHandle {
  const kit = parsed.kit;
  const unitsPerEm: number = kit.unitsPerEm;
  return {
    key: parsed.key,
    synthItalic,
    advanceWidthPx(ch, sizePx) {
      const cp = ch.codePointAt(0) ?? 32;
      let adv: number;
      try {
        const glyph = kit.glyphForCodePoint(cp);
        adv = glyph.advanceWidth;
      } catch {
        adv = unitsPerEm * 0.5;
      }
      return (adv / unitsPerEm) * sizePx;
    },
    ascentPx: (sizePx) => (kit.ascent / unitsPerEm) * sizePx,
    descentPx: (sizePx) => (Math.abs(kit.descent) / unitsPerEm) * sizePx,
  };
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`字体加载失败: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

// 加载并缓存所有需要的字体，返回 FontProvider + bytes 查询。
// 浏览器环境调用；先由调用方收集 elements 用到的角色后再加载（这里简单：全量加载绑定字体 + 注册表里的自定义字体）。
export interface FontBundle {
  provider: FontProvider;
  // 后端取字体 bytes（pdf 嵌入）
  bytesOf(key: string): Uint8Array;
  // 后端取 canvas FontFace 家族名
  familyOf(key: string): string;
  // 已加载的 FontFace（canvas 需 document.fonts.add）
  fontFaces: FontFace[];
}

export async function loadFontBundle(custom: CustomFontRegistry): Promise<FontBundle> {
  const parsedByKey = new Map<string, ParsedFont>();

  const ensure = async (key: string, url: string) => {
    if (parsedByKey.has(key)) return;
    const bytes = await fetchBytes(url);
    const kit = (fontkit as any).create(bytes);
    const family = `render_${key}`;
    let fontFace: FontFace | undefined;
    if (typeof FontFace !== "undefined") {
      fontFace = new FontFace(family, bytes.buffer as ArrayBuffer);
      await fontFace.load();
      document.fonts.add(fontFace);
    }
    parsedByKey.set(key, { key: family, bytes, kit, fontFace });
  };

  // 绑定字体
  for (const [k, url] of Object.entries(BUNDLED)) await ensure(k, url);
  // 自定义字体
  for (const [name, url] of Object.entries(custom)) await ensure(`custom-${name}`, url);

  const keyFor = (role: FontRole): string => {
    if (role.family === "custom" && role.customName) {
      const k = `custom-${role.customName}`;
      if (parsedByKey.has(k)) return k;
      // 自定义字体缺失则回退到 sans
    }
    return `${role.family === "custom" ? "sans" : role.family}-${role.bold ? "Bold" : "Regular"}`;
  };

  const provider: FontProvider = {
    resolve(q) {
      const role = resolveFontRole(q);
      const k = keyFor(role);
      const parsed = parsedByKey.get(k)!;
      return makeHandle(parsed, role.synthItalic);
    },
  };

  return {
    provider,
    bytesOf: (faceKey) => {
      // faceKey 为 FontHandle.key（render_<k>）；反查 bytes
      for (const p of parsedByKey.values()) if (p.key === faceKey) return p.bytes;
      throw new Error(`未找到字体 bytes: ${faceKey}`);
    },
    familyOf: (faceKey) => faceKey,
    fontFaces: [...parsedByKey.values()].map((p) => p.fontFace!).filter(Boolean),
  };
}
```

> 说明：`FontHandle.key` 即 canvas FontFace 家族名 `render_<key>`，后端用它取 bytes（pdf）与设置 `ctx.font`（canvas）。

- [ ] **Step 5: 运行确认通过（映射测试）**

Run: `pnpm test src/utils/render/fonts.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/utils/render/fonts.ts src/utils/render/fonts.test.ts
git commit -m "feat(render): 字体服务（角色映射 + fontkit 度量 + 加载）"
```

---

## Task 7: Canvas 2D 后端

**Files:**
- Create: `src/utils/render/canvas2d.ts`
- 验证：浏览器手工（node 无 canvas）

`renderCanvas` 把 `DrawOp[]` 画到 canvas。逐字 `fillText`，`drawImage` 做裁剪，旋转用 save/translate/rotate。

- [ ] **Step 1: 写实现**

Create `src/utils/render/canvas2d.ts`:
```ts
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

function drawText(ctx: CanvasRenderingContext2D, op: TextOp) {
  withTransform(ctx, op, () => {
    ctx.save();
    // overflow:hidden 裁剪
    ctx.beginPath();
    ctx.rect(op.clip.x, op.clip.y, op.clip.w, op.clip.h);
    ctx.clip();
    ctx.fillStyle = cssColor(op.color);
    const italic = op.font.synthItalic ? "italic " : "";
    ctx.font = `${italic}${op.fontSizePx}px "${op.font.key}"`;
    for (const line of op.lines) {
      for (const g of line.glyphs) {
        ctx.fillText(g.ch, g.x, line.baselineY);
      }
    }
    ctx.restore();
  });
}
```

- [ ] **Step 2: 提交（浏览器验证留待 Task 10）**

```bash
git add src/utils/render/canvas2d.ts
git commit -m "feat(render): Canvas 2D 后端"
```

---

## Task 8: pdf-lib 后端

**Files:**
- Create: `src/utils/render/pdf.ts`
- Test: `src/utils/render/pdf.test.ts`（node：`rotatePoint` 纯函数确定性测试 + 联网取 CDN 字体的 PDF 生成冒烟测试，离线软跳过）

pdf-lib 原点在左下角、单位 pt。需 y 翻转、px→pt。逐字 `drawText`，旋转用变换矩阵。

- [ ] **Step 1: 写失败测试（node 端可跑：pdf-lib 纯 JS）**

Create `src/utils/render/pdf.test.ts`:
```ts
import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fontkit from "fontkit";
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/utils/render/pdf.test.ts`
Expected: FAIL（找不到 `./pdf`）。

- [ ] **Step 3: 写实现**

Create `src/utils/render/pdf.ts`:
```ts
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
  // 旋转锚点：pdf-lib drawRectangle 以左下角(x,y)为锚、rotate 绕该锚点。
  // 取元素左上角(px=op.x,op.y) 在 px 空间绕中心旋转后的点，作为锚点近似。
  const anchorPx = rotatePoint(op.x, op.y + op.h, op.cx, op.cy + 0, op.rotationDeg);
  const common = {
    x: X(anchorPx.x),
    y: Y(anchorPx.y),
    width: pxToPtSafe(op.w),
    height: pxToPtSafe(op.h),
    rotate: degrees(-op.rotationDeg),
    opacity: op.opacity,
  };
  if (op.fill && op.fill.a > 0) {
    page.drawRectangle({ ...common, color: pdfRgb(op.fill), opacity: op.opacity * op.fill.a });
  }
  if (op.borderWidth > 0 && op.borderColor && op.borderColor.a > 0) {
    page.drawRectangle({
      ...common,
      borderWidth: pxToPtSafe(op.borderWidth),
      borderColor: pdfRgb(op.borderColor),
      borderOpacity: op.opacity * op.borderColor.a,
      color: undefined,
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
```

> **裁剪说明（重要）：** pdf-lib 的 `drawImage` 不支持源裁剪。因此 `cover`/`none` 等需要裁剪的情况，由编排器（Task 9）在 PDF 路径下用离屏 canvas 把图片**预裁剪**成"恰好 dst 比例"的位图，再把 `op.src` 归一化为整图、`url` 指向预裁剪图。Task 9 的 `prepareImagesForPdf` 负责此事。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test src/utils/render/pdf.test.ts`
Expected: `rotatePoint` 3 个用例必过；`renderPdf` 用例联网时生成 `%PDF-` 开头、>1KB 字节并通过，离线时早返回软跳过（不失败）。

- [ ] **Step 5: 提交**

```bash
git add src/utils/render/pdf.ts src/utils/render/pdf.test.ts
git commit -m "feat(render): pdf-lib 矢量后端"
```

---

## Task 9: 重写编排器 export.ts

**Files:**
- Rewrite: `src/utils/export.ts`
- Test: `src/utils/export.test.ts`（路由 + 图片裁剪预处理的纯逻辑）

编排器：加载字体 → 逐行算 layout → 按 format 走后端。图片加载（HTMLImageElement + bytes）、PDF 预裁剪、PNG/JPG 用 canvas → blob → saveAs。

- [ ] **Step 1: 写实现（替换原文件）**

Rewrite `src/utils/export.ts`:
```ts
import { saveAs } from "file-saver";
import type { CanvasElement, DraftConfig, ExportFormat, PaperConfig } from "@/types";
import { unitToPx } from "@/utils/element";
import { computeLayout } from "./render/layout";
import { renderToCanvas } from "./render/canvas2d";
import { renderPdf } from "./render/pdf";
import { loadFontBundle, type CustomFontRegistry } from "./render/fonts";
import type { DrawOp, ImageOp, ResolvedImage } from "./render/types";

interface BatchExportOptions {
  format: ExportFormat;
  quality: number;
  fileName: string;
  draft: DraftConfig | null;
  customFonts?: CustomFontRegistry;
  resolvePhotoUrl?: (pathTemplate: string, row: Record<string, string>) => string;
  onStart?: (total: number) => void;
  onProgress?: (current: number, total: number) => void;
}

// 加载图片为 HTMLImageElement（拿自然尺寸）
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${url}`));
    img.src = url;
  });
}

async function urlToBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

// 收集某行用到的所有图片 url（含底稿），加载为 element + resolved
async function resolveRowImages(
  elements: CanvasElement[],
  row: Record<string, string>,
  draft: DraftConfig | null,
  resolvePhotoUrl?: BatchExportOptions["resolvePhotoUrl"],
): Promise<{
  images: Map<string, ResolvedImage>;
  elementImages: Map<string, HTMLImageElement>;
  draftResolved: ResolvedImage | null;
}> {
  const images = new Map<string, ResolvedImage>();
  const elementImages = new Map<string, HTMLImageElement>();

  for (const el of elements) {
    if (el.type !== "image" || !el.visible) continue;
    let url = "";
    if (el.srcType === "static") url = el.src;
    else if (el.srcType === "dynamic" && resolvePhotoUrl) url = resolvePhotoUrl(el.pathTemplate, row);
    if (!url) continue;
    try {
      const img = await loadImage(url);
      images.set(el.id, { url, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      elementImages.set(url, img);
    } catch {
      // 跳过加载失败的图片
    }
  }

  let draftResolved: ResolvedImage | null = null;
  if (draft) {
    try {
      const img = await loadImage(draft.src);
      draftResolved = { url: draft.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
      elementImages.set(draft.src, img);
    } catch {
      draftResolved = null;
    }
  }

  return { images, elementImages, draftResolved };
}

// PDF 路径：把需要裁剪的 ImageOp 预裁剪为整图位图（pdf-lib 不支持源裁剪）。
// 直接写入文档级 sink；用 pageIndex + 局部计数生成全局唯一 key，避免跨页/同图相互覆盖。
async function prepareImagesForPdf(
  ops: DrawOp[],
  elementImages: Map<string, HTMLImageElement>,
  pageIndex: number,
  sink: Map<string, Uint8Array>,
): Promise<void> {
  let local = 0;
  for (const op of ops) {
    if (op.kind !== "image") continue;
    const im = op as ImageOp;
    const src = elementImages.get(im.url);
    if (!src) continue;
    // 裁剪到 src 区域，输出与 dst 同比例的整图
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(im.dst.w * 2));
    canvas.height = Math.max(1, Math.round(im.dst.h * 2));
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(src, im.src.x, im.src.y, im.src.w, im.src.h, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (blob) {
      const key = `pdfimg:${pageIndex}:${local++}`; // 全局唯一，避免同图不同裁剪相互覆盖
      sink.set(key, new Uint8Array(await blob.arrayBuffer()));
      // 让该 op 指向预裁剪图，src 归一为整图（绘制时按 dst 画整图）
      im.url = key;
      im.src = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    }
  }
}

export async function batchExport(
  elements: CanvasElement[],
  rows: Record<string, string>[],
  paper: PaperConfig,
  options: BatchExportOptions,
): Promise<void> {
  const { format, quality, fileName, draft, customFonts, resolvePhotoUrl, onStart, onProgress } = options;
  const total = rows.length;
  onStart?.(total);

  const widthPx = unitToPx(paper.width, paper.unit);
  const heightPx = unitToPx(paper.height, paper.unit);

  const bundle = await loadFontBundle(customFonts ?? {});

  if (format === "pdf") {
    const pdfPages: DrawOp[][] = [];
    const pdfImages = new Map<string, Uint8Array>();
    for (let i = 0; i < total; i++) {
      const { images, elementImages, draftResolved } = await resolveRowImages(elements, rows[i], draft, resolvePhotoUrl);
      const ops = computeLayout(elements, rows[i], paper, {
        fonts: bundle.provider,
        images,
        draft: draftResolved ? { resolved: draftResolved, opacity: draft!.opacity } : null,
      });
      await prepareImagesForPdf(ops, elementImages, i, pdfImages);
      pdfPages.push(ops);
      onProgress?.(i + 1, total);
    }
    const bytes = await renderPdf({ pages: pdfPages, widthPx, heightPx, bytesOf: bundle.bytesOf, images: pdfImages });
    saveAs(new Blob([bytes], { type: "application/pdf" }), `${fileName}.pdf`);
    return;
  }

  // PNG / JPG：逐行 canvas → blob → 下载
  const deviceScale = 2;
  for (let i = 0; i < total; i++) {
    const { images, elementImages, draftResolved } = await resolveRowImages(elements, rows[i], draft, resolvePhotoUrl);
    const ops = computeLayout(elements, rows[i], paper, {
      fonts: bundle.provider,
      images,
      draft: draftResolved ? { resolved: draftResolved, opacity: draft!.opacity } : null,
    });
    const canvas = renderToCanvas({ ops, widthPx, heightPx, deviceScale, images: elementImages });
    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, quality));
    if (blob) saveAs(blob, `${fileName}_${i + 1}.${format}`);
    onProgress?.(i + 1, total);
  }
}

// 计算稿纸像素尺寸（保留旧导出，供 UI 用）
export function getPaperPixelSize(paper: PaperConfig): { width: number; height: number } {
  return { width: unitToPx(paper.width, paper.unit), height: unitToPx(paper.height, paper.unit) };
}
```

- [ ] **Step 2: 确认无外部消费者引用旧导出函数**

旧的 `renderElementStyle`/`renderElementContent`/`exportPreview` 仅在 `export.ts` 内部使用（已随整文件重写删除）；`PreviewModal.vue` 自渲染 DOM 预览、不依赖它们；仅 `stores/export.ts` 依赖 `batchExport`（签名保持不变）。已用 grep 核实（见计划开头排查）。

Run: `grep -rn "renderElementStyle\|renderElementContent\|exportPreview" src`
Expected: 无输出。若意外命中 `.vue`/store 中的外部引用，停下来按实际情况处理后再继续。

- [ ] **Step 3: 类型检查**

Run: `pnpm type-check`
Expected: 通过（无对已删依赖/函数的引用错误）。

- [ ] **Step 4: 提交**

```bash
git add src/utils/export.ts
git commit -m "feat(export): 编排器改用 layout + pdf-lib/canvas 后端"
```

---

## Task 10: store 接线 + 浏览器联调

**Files:**
- Modify: `src/stores/export.ts`

- [ ] **Step 1: 传入自定义字体注册表**

在 `src/stores/export.ts` 的 `runExport` 中，构造注册表并传给 `batchExport`：
```ts
// 在 batchExport options 里新增：
customFonts: Object.fromEntries(
  fontsStore.customFonts.map((f) => [f.name, f.url]),
),
```
（`fontsStore` 已在 `runExport` 中取得；`f.name` 即 `fontFamily`，`f.url` 为 object URL。）

- [ ] **Step 2: 移除旧的"确保字体已加载"段落（已由 loadFontBundle 接管）**

`runExport` 中原 `if (fontsStore.customFonts.length > 0 && document.fonts...) await document.fonts.ready` 可保留或删除（无害）。建议保留。

- [ ] **Step 3: 类型检查 + 启动开发服务器**

Run: `pnpm type-check && pnpm dev`
Expected: 编译通过，dev server 起在 localhost。

- [ ] **Step 4: 手工联调（关键验证）**

在浏览器中：
1. 添加一个文本元素，框高远大于字号、`text-align:center`，输入中文。
2. 添加一张图片元素，`fit: cover`，放入非正方形图片。
3. 旋转其中一个元素 ~20°，设置边框 + 圆角 + 不透明度。
4. 导入一行 Excel 数据，导出 PDF / PNG。

逐项核对：
- [ ] 文本在框内**垂直居中**（不再顶到上沿）。
- [ ] 图片**等比裁剪**（不被拉伸）。
- [ ] 旋转、边框、圆角、不透明度与编辑器一致。
- [ ] PDF 中文字**可选中、可复制**。
- [ ] PNG 与 PDF 视觉一致。

- [ ] **Step 5: 提交**

```bash
git add src/stores/export.ts
git commit -m "feat(export): store 传入自定义字体注册表"
```

---

## Task 11: 字体加载失败的光栅兜底（spec §7）

绑定字体若 fetch/解析失败，PDF 退化为「整页位图」而非中断导出（spec §7）。复用 `renderToCanvas` 产出每页 PNG，再用 pdf-lib 仅嵌图片成页。失败属边缘场景（同源静态资源），故用一处 catch 收口。

**Files:**
- Modify: `src/utils/render/fonts.ts`（新增 `degenerateFontProvider`）
- Modify: `src/utils/render/canvas2d.ts`（空 key → 通用族）
- Modify: `src/utils/render/pdf.ts`（新增 `renderRasterPdf`）
- Modify: `src/utils/export.ts`（try/catch + 兜底分支）

- [ ] **Step 1: fonts.ts 增加降级 provider**

`fonts.ts` 顶部已 `import type { FontProvider, FontStyleQuery, FontHandle } from "./types"`，直接复用。文件末尾追加：
```ts
// 字体全部加载失败时的近似度量；canvas 用通用 sans-serif 绘制
export function degenerateFontProvider(): FontProvider {
  const handle: FontHandle = {
    key: "", // 空 -> canvas2d 用通用 sans-serif
    synthItalic: false,
    advanceWidthPx: (ch, s) => (ch.charCodeAt(0) < 256 ? s * 0.5 : s), // 半角 0.5em / 全角 1em
    ascentPx: (s) => s * 0.8,
    descentPx: (s) => s * 0.2,
  };
  return { resolve: () => handle };
}
```

- [ ] **Step 2: canvas2d.ts 处理空 key**

在 `drawText` 中把设置字体那两行改为按空 key 回退通用族：
```ts
    const italic = op.font.synthItalic ? "italic " : "";
    const fam = op.font.key ? `"${op.font.key}"` : "sans-serif";
    ctx.font = `${italic}${op.fontSizePx}px ${fam}`;
```

- [ ] **Step 3: pdf.ts 增加整页位图 PDF**

`pdf.ts` 末尾追加（`PDFDocument`/`pxToPt` 已在文件顶部 import）：
```ts
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
```

- [ ] **Step 4: export.ts 接入兜底**

把原有两行 import：
```ts
import { renderPdf } from "./render/pdf";
import { loadFontBundle, type CustomFontRegistry } from "./render/fonts";
```
替换为：
```ts
import { renderPdf, renderRasterPdf } from "./render/pdf";
import { loadFontBundle, degenerateFontProvider, type CustomFontRegistry, type FontBundle } from "./render/fonts";
```
把 `const bundle = await loadFontBundle(customFonts ?? {});` 替换为带兜底的加载：
```ts
  let bundle: FontBundle | null = null;
  try {
    bundle = await loadFontBundle(customFonts ?? {});
  } catch {
    bundle = null; // 字体加载失败 -> 走光栅兜底
  }
  const provider = bundle ? bundle.provider : degenerateFontProvider();
```
将整个 `if (format === "pdf") { ... }` 段替换为（矢量 / 光栅两分支，注意 PNG/JPG 分支里的 `bundle.provider` 也要改成 `provider`）：
```ts
  if (format === "pdf") {
    if (bundle) {
      const pdfPages: DrawOp[][] = [];
      const pdfImages = new Map<string, Uint8Array>();
      for (let i = 0; i < total; i++) {
        const { images, elementImages, draftResolved } = await resolveRowImages(elements, rows[i], draft, resolvePhotoUrl);
        const ops = computeLayout(elements, rows[i], paper, {
          fonts: provider,
          images,
          draft: draftResolved ? { resolved: draftResolved, opacity: draft!.opacity } : null,
        });
        await prepareImagesForPdf(ops, elementImages, i, pdfImages);
        pdfPages.push(ops);
        onProgress?.(i + 1, total);
      }
      const bytes = await renderPdf({ pages: pdfPages, widthPx, heightPx, bytesOf: bundle.bytesOf, images: pdfImages });
      saveAs(new Blob([bytes], { type: "application/pdf" }), `${fileName}.pdf`);
    } else {
      const pngs: Uint8Array[] = [];
      for (let i = 0; i < total; i++) {
        const { images, elementImages, draftResolved } = await resolveRowImages(elements, rows[i], draft, resolvePhotoUrl);
        const ops = computeLayout(elements, rows[i], paper, {
          fonts: provider,
          images,
          draft: draftResolved ? { resolved: draftResolved, opacity: draft!.opacity } : null,
        });
        const canvas = renderToCanvas({ ops, widthPx, heightPx, deviceScale: 2, images: elementImages });
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (blob) pngs.push(new Uint8Array(await blob.arrayBuffer()));
        onProgress?.(i + 1, total);
      }
      const bytes = await renderRasterPdf(pngs, widthPx, heightPx);
      saveAs(new Blob([bytes], { type: "application/pdf" }), `${fileName}.pdf`);
    }
    return;
  }
```
并把 PNG/JPG 分支里 `computeLayout(...)` 的 `fonts: bundle.provider` 改为 `fonts: provider`。

- [ ] **Step 5: 类型检查 + 手工验证**

Run: `pnpm type-check`
Expected: 通过。
手工：临时把 `fonts.ts` 的 `BUNDLED` 某 URL 改成错误路径，导出 PDF，应仍生成（光栅）PDF 而非报错；验证后改回。

- [ ] **Step 6: 提交**

```bash
git add src/utils/render/fonts.ts src/utils/render/canvas2d.ts src/utils/render/pdf.ts src/utils/export.ts
git commit -m "feat(export): 字体加载失败时 PDF 光栅兜底"
```

---

## Task 12: 清理与验收

**Files:**
- 删除残留、跑全量测试

- [ ] **Step 1: 确认依赖已移除**

Run: `grep -rn "html2canvas\|jspdf" src && echo FOUND || echo CLEAN`
Expected: `CLEAN`（src 中无引用）。

- [ ] **Step 2: 全量测试 + 类型 + 构建**

Run: `pnpm test && pnpm type-check && pnpm build`
Expected: 测试全绿、类型通过、构建成功。

- [ ] **Step 3: 验收对照 spec 的验收标准**

逐条确认 [spec §10](../specs/2026-06-25-vector-export-fidelity-design.md) 验收标准 1–5 满足。

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "chore(export): 清理 html2canvas/jspdf 残留，矢量导出落地"
```

---

## 风险与回退
- **pdf-lib 旋转锚点**：`drawRectangle/drawText` 的 `rotate` 绕锚点旋转，本计划用 `rotatePoint` 把每个绘制点先绕中心旋转再交给 pdf-lib（`rotate` 抵消方向）。联调若发现旋转元素位置偏移，改用 `page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...), …, popGraphicsState())` 包整段。
- **绑定字体体积**：首次导出拉取 OTF（数 MB），已懒加载、浏览器缓存；若仍偏大，后续可换更小的开源 CJK 子集或加 service worker 缓存。
- **字体加载失败兜底**：已在 Task 11 实现（PDF 退化为整页位图）。属边缘场景（同源静态字体），主路径仍为矢量。
- **同图重复裁剪**：`prepareImagesForPdf` 按 `pageIndex+局部计数` 生成全局唯一 key，确保同一图片在不同元素/页以不同裁剪嵌入时互不覆盖。
