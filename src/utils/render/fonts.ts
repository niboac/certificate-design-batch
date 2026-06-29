import * as fontkit from "fontkit";
import type { FontProvider, FontStyleQuery, FontHandle } from "./types";
import type { FontWeight } from "@/types";

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
function makeHandle(parsed: ParsedFont, familyName: string, synthItalic: boolean, fontWeight?: FontWeight): FontHandle {
  const kit = parsed.kit;
  const unitsPerEm: number = kit.unitsPerEm;

  // 计算字体的实际 ascent/descent（使用 bbox 或设计度量）
  let fontAscent: number;
  let fontDescent: number;
  try {
    // 尝试使用字体的 bbox（更准确的视觉边界）
    const bbox = kit.bbox;
    if (bbox) {
      fontAscent = bbox.maxY;
      fontDescent = Math.abs(bbox.minY);
    } else {
      // fallback 到字体设计度量
      fontAscent = kit.ascent;
      fontDescent = Math.abs(kit.descent);
    }
  } catch {
    // fallback 到通用比例（类似 Arial/Helvetica）
    fontAscent = unitsPerEm * 0.8;
    fontDescent = unitsPerEm * 0.2;
  }

  return {
    key: parsed.key,
    familyName,
    synthItalic,
    fontWeight,
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
    ascentPx: (sizePx) => (fontAscent / unitsPerEm) * sizePx,
    descentPx: (sizePx) => (fontDescent / unitsPerEm) * sizePx,
  };
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`字体加载失败: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

// 加载并缓存所有需要的字体，返回 FontProvider + bytes 查询。
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
    return null;
  };

  const provider: FontProvider = {
    async resolve(q) {
      const role = resolveFontRole(q);
      const k = keyFor(role);

      if (!k) {
        // 无匹配字体：返回近似度量，Canvas 用原始 font-family 字符串，浏览器自动 fallback 到系统字体
        return {
          key: "",
          familyName: q.fontFamily,
          synthItalic: role.synthItalic,
          fontWeight: q.fontWeight,
          advanceWidthPx: (ch, s) => (ch.charCodeAt(0) < 256 ? s * 0.5 : s),
          ascentPx: (s) => s * 0.8,
          descentPx: (s) => s * 0.2,
        };
      }

      const parsed = parsedByKey.get(k)!;
      // 系统字体或自定义字体：用 fontkit 提供精确度量，familyName 保留原始名
      return makeHandle(parsed, q.fontFamily, role.synthItalic, q.fontWeight);
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
  return {
    resolve: (q) =>
      Promise.resolve({
        key: "", // 空 -> canvas2d 用通用 sans-serif
        familyName: "sans-serif", // 使用通用字体名作为 fallback
        synthItalic: false,
        fontWeight: q.fontWeight,
        advanceWidthPx: (ch, s) => (ch.charCodeAt(0) < 256 ? s * 0.5 : s), // 半角 0.5em / 全角 1em
        ascentPx: (s) => s * 0.8,
        descentPx: (s) => s * 0.2,
      }),
  };
}
