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
