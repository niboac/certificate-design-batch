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
