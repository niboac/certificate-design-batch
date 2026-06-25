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
