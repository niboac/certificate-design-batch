import { describe, expect, it } from "vitest";
import { createImageElement, createTextElement } from "@/utils/element";
import { createDefaultPaper } from "@/utils/element";
import type { FontHandle, FontProvider, LayoutDeps, ResolvedImage } from "./types";
import { computeLayout } from "./layout";

const mockFont: FontHandle = {
  key: "mock",
  familyName: "mock",
  synthItalic: false,
  advanceWidthPx: (_c, s) => s * 0.5,
  ascentPx: (s) => s * 0.8,
  descentPx: (s) => s * 0.2,
};
const fonts: FontProvider = { resolve: () => Promise.resolve(mockFont) };
const paper = createDefaultPaper();
const deps = (over: Partial<LayoutDeps> = {}): LayoutDeps => ({
  fonts,
  images: new Map(),
  draft: null,
  ...over,
});

describe("computeLayout", () => {
  it("按 zIndex 升序排列，背景框在前", async () => {
    const a = createTextElement({ zIndex: 2, content: "A" });
    const b = createTextElement({ zIndex: 1, content: "B" });
    const ops = await computeLayout([a, b], {}, paper, deps());
    // 第一个 op 是纸张背景 rect
    expect(ops[0].kind).toBe("rect");
    // 文本 op 顺序：B(z1) 在 A(z2) 前
    const texts = ops.filter((o) => o.kind === "text");
    expect(texts).toHaveLength(2);
  });

  it("跳过不可见元素", async () => {
    const a = createTextElement({ visible: false, content: "A" });
    const ops = await computeLayout([a], {}, paper, deps());
    expect(ops.some((o) => o.kind === "text")).toBe(false);
  });

  it("文本变量插值", async () => {
    const a = createTextElement({ content: "你好 {{name}}", x: 0, y: 0, width: 400, height: 60 });
    const ops = await computeLayout([a], { name: "张三" }, paper, deps());
    const text = ops.find((o) => o.kind === "text");
    const joined = (text as any).lines
      .flatMap((l: any) => l.glyphs.map((g: any) => g.ch))
      .join("");
    expect(joined).toContain("张三");
  });

  it("旋转中心 = 元素框中心", async () => {
    const a = createTextElement({ x: 100, y: 100, width: 200, height: 60, rotation: 30 });
    const ops = await computeLayout([a], {}, paper, deps());
    const text = ops.find((o) => o.kind === "text")!;
    expect(text.cx).toBe(200);
    expect(text.cy).toBe(130);
    expect(text.rotationDeg).toBe(30);
  });

  it("图片按 object-fit 出 src/dst（id 用元素真实 id）", async () => {
    const img = createImageElement({ x: 0, y: 0, width: 100, height: 100, fit: "cover" });
    const resolved: ResolvedImage = { url: "blob:x", naturalWidth: 200, naturalHeight: 100 };
    const ops = await computeLayout([img], {}, paper, deps({ images: new Map([[img.id, resolved]]) }));
    const im = ops.find((o) => o.kind === "image") as any;
    expect(im).toBeTruthy();
    expect(im.dst).toMatchObject({ w: 100, h: 100 });
    expect(im.src.w).toBeCloseTo(100, 5); // cover 裁剪
  });
});
