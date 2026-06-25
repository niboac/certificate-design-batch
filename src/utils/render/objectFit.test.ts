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
  it("none: 小图不缩放、居中（natural < box）", () => {
    const r = computeObjectFit("none", { w: 50, h: 40 }, { w: 100, h: 100 });
    expect(r.src).toEqual({ x: 0, y: 0, w: 50, h: 40 });
    expect(r.dst).toEqual({ x: 25, y: 30, w: 50, h: 40 });
  });
  it("scale-down: 小图取 none（不放大）", () => {
    const r = computeObjectFit("scale-down", { w: 50, h: 40 }, { w: 100, h: 100 });
    expect(r.dst).toEqual({ x: 25, y: 30, w: 50, h: 40 });
  });
});
