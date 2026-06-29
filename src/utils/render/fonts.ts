import * as fontkit from "fontkit";
import type { FontProvider, FontStyleQuery, FontHandle } from "./types";

export interface FontRole {
  family: "sans" | "serif" | "custom" | "system";
  bold: boolean;
  synthItalic: boolean;
  customName?: string;
  systemName?: string;
}

// 自定义字体注册表：fontFamily -> 字体文件 URL（object URL）
export type CustomFontRegistry = Record<string, string>;

// 系统字体注册表：fontFamily -> 字体文件 ArrayBuffer
export type SystemFontRegistry = Record<string, ArrayBuffer>;

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
  const numericWeight = Number(q.fontWeight);
  const weight =
    WEIGHT_NUM[q.fontWeight] ?? (Number.isFinite(numericWeight) ? numericWeight : 400);
  const bold = weight >= 600;

  if (q.fontFamily.startsWith("custom_")) {
    return { family: "custom", bold, synthItalic, customName: q.fontFamily };
  }

  // 判断是否为衬线字体（排除 "sans-serif" 的情况）
  const lower = q.fontFamily.toLowerCase();
  const isSerif =
    (!lower.includes("sans") && lower.includes("serif")) ||
    lower.includes("song") ||
    lower.includes("sun") ||
    lower.includes("宋") ||
    lower.includes("kai") ||
    lower.includes("楷") ||
    lower.includes("fang") ||
    lower.includes("仿") ||
    lower.includes("times") ||
    lower.includes("georgia");

  // 保留 serif/sans 分类用于 CDN fallback，同时记录 systemName 用于系统字体匹配
  return {
    family: isSerif ? "serif" : "sans",
    bold,
    synthItalic,
    systemName: q.fontFamily,
  };
}

interface ParsedFont {
  key: string;
  bytes: Uint8Array;
  kit: any; // fontkit Font
  fontFace?: FontFace;
}

// fontkit 无默认导出，使用命名空间上的 create（node 与浏览器构建均可用）
const fontkitCreate = (buf: Buffer | Uint8Array): any => (fontkit as any).create(buf);

// 用 fontkit 度量构造 FontHandle
function makeHandle(parsed: ParsedFont, familyName: string, synthItalic: boolean): FontHandle {
  const kit = parsed.kit;
  const unitsPerEm: number = kit.unitsPerEm;
  return {
    key: parsed.key,
    familyName,
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

export async function loadFontBundle(
  custom: CustomFontRegistry,
  systemFonts: SystemFontRegistry = {},
): Promise<FontBundle> {
  const parsedByKey = new Map<string, ParsedFont>();
  const systemFontKeys = new Map<string, string>(); // fontFamily -> key
  const bytesByFaceKey = new Map<string, Uint8Array>(); // faceKey -> bytes

  const ensure = async (key: string, source: string | ArrayBuffer, faceFamily?: string) => {
    if (parsedByKey.has(key)) return;
    const bytes = typeof source === "string" ? await fetchBytes(source) : new Uint8Array(source);
    const kit = fontkitCreate(bytes as any);
    const family = faceFamily || `render_${key}`;
    let fontFace: FontFace | undefined;
    if (typeof FontFace !== "undefined") {
      fontFace = new FontFace(family, bytes.buffer as ArrayBuffer);
      await fontFace.load();
      document.fonts.add(fontFace);
    }
    const parsed: ParsedFont = { key: family, bytes, kit, fontFace };
    parsedByKey.set(key, parsed);
    bytesByFaceKey.set(family, bytes);
  };

  // 加载系统字体（使用原始字体名作为 FontFace 家族名，确保预览和导出一致）
  for (const [name, buffer] of Object.entries(systemFonts)) {
    const key = `system-${name}`;
    await ensure(key, buffer, name);
    systemFontKeys.set(name, key);
  }

  // 预加载 CDN 基础字体（仅用于度量计算和 PDF 嵌入兜底）
  // 不注册为中文字体别名，避免污染 document.fonts 覆盖系统字体
  await ensure("serif-Regular", BUNDLED["serif-Regular"], "__noto_serif_sc__");
  await ensure("serif-Bold", BUNDLED["serif-Bold"], "__noto_serif_sc_bold__");
  await ensure("sans-Regular", BUNDLED["sans-Regular"], "__noto_sans_sc__");
  await ensure("sans-Bold", BUNDLED["sans-Bold"], "__noto_sans_sc_bold__");

  // 自定义字体
  for (const [name, url] of Object.entries(custom)) await ensure(`custom-${name}`, url);

  const keyFor = (role: FontRole): string | null => {
    if (role.family === "custom" && role.customName) {
      const k = `custom-${role.customName}`;
      if (parsedByKey.has(k)) return k;
    }
    // 尝试匹配系统字体（serif/sans 角色都可能有 systemName）
    if (role.systemName) {
      // 精确匹配系统字体名
      if (systemFontKeys.has(role.systemName)) {
        return systemFontKeys.get(role.systemName)!;
      }
      // 模糊匹配（去掉字体名中的 fallback 部分）
      const baseName = role.systemName.split(",")[0].trim().replace(/["']/g, "");
      if (systemFontKeys.has(baseName)) {
        return systemFontKeys.get(baseName)!;
      }
    }
    // fallback 到 CDN 字体
    const fallbackFamily = role.family === "serif" ? "serif" : "sans";
    const fallbackKey = `${fallbackFamily}-${role.bold ? "Bold" : "Regular"}`;
    if (parsedByKey.has(fallbackKey)) return fallbackKey;
    return null;
  };

  // 懒加载 CDN 字体（需要时才加载）
  const ensureCdnFont = async (familyType: "sans" | "serif", bold: boolean) => {
    const key = `${familyType}-${bold ? "Bold" : "Regular"}`;
    if (!parsedByKey.has(key)) {
      await ensure(key, BUNDLED[key]);
    }
  };

  const provider: FontProvider = {
    async resolve(q) {
      const role = resolveFontRole(q);
      let k = keyFor(role);

      // 如果没有匹配到，尝试加载 CDN fallback 字体（仅用于度量计算）
      if (!k) {
        const lower = q.fontFamily.toLowerCase();
        const isSerif =
          lower.includes("serif") ||
          lower.includes("song") ||
          lower.includes("sun") ||
          lower.includes("宋") ||
          lower.includes("kai") ||
          lower.includes("楷") ||
          lower.includes("fang") ||
          lower.includes("仿") ||
          lower.includes("times") ||
          lower.includes("georgia");
        const familyType = isSerif ? "serif" : "sans";
        const weight = WEIGHT_NUM[q.fontWeight] ?? 400;
        const bold = weight >= 600;
        await ensureCdnFont(familyType, bold);
        k = keyFor(role);
      }

      if (!k) {
        // 最后兜底：返回近似度量
        return {
          key: "",
          familyName: q.fontFamily,
          synthItalic: role.synthItalic,
          advanceWidthPx: (ch, s) => (ch.charCodeAt(0) < 256 ? s * 0.5 : s),
          ascentPx: (s) => s * 0.8,
          descentPx: (s) => s * 0.2,
        };
      }

      const parsed = parsedByKey.get(k)!;

      // 对于系统字体和自定义字体：直接使用已注册的 FontFace
      // 对于 CDN 兜底字体：仅用于度量计算，不注册为用户字体名的别名
      // Canvas 2D 渲染时直接使用用户选择的 font-family 字符串，浏览器会自动匹配系统字体
      if (k.startsWith("system-") || k.startsWith("custom-")) {
        // 系统字体或自定义字体：用 fontkit 提供精确度量，familyName 保留原始名
        return makeHandle(parsed, q.fontFamily, role.synthItalic);
      }

      // CDN 兜底路径：使用 CDN 字体的精确度量，但 familyName 保留用户选择的字体名
      // 这样 Canvas 2D 渲染时会尝试系统字体，而不是被 CDN 字体替代
      return makeHandle(parsed, q.fontFamily, role.synthItalic);
    },
  };

  return {
    provider,
    bytesOf: (faceKey) => {
      const bytes = bytesByFaceKey.get(faceKey);
      if (bytes) return bytes;
      throw new Error(`未找到字体 bytes: ${faceKey}`);
    },
    familyOf: (faceKey) => faceKey,
    fontFaces: [...parsedByKey.values()].map((p) => p.fontFace!).filter(Boolean),
  };
}

// 字体全部加载失败时的近似度量；canvas 用通用 sans-serif 绘制
export function degenerateFontProvider(): FontProvider {
  const handle: FontHandle = {
    key: "", // 空 -> canvas2d 用通用 sans-serif
    familyName: "sans-serif", // 使用通用字体名作为 fallback
    synthItalic: false,
    advanceWidthPx: (ch, s) => (ch.charCodeAt(0) < 256 ? s * 0.5 : s), // 半角 0.5em / 全角 1em
    ascentPx: (s) => s * 0.8,
    descentPx: (s) => s * 0.2,
  };
  return { resolve: () => Promise.resolve(handle) };
}
