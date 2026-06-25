import * as fontkit from "fontkit";
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
    lower.includes("sun") ||
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

// fontkit.create 兼容 ESM named export 与 CJS default
const fontkitCreate: (buf: Buffer | Uint8Array) => any =
  typeof (fontkit as any).default?.create === "function"
    ? (buf) => (fontkit as any).default.create(buf)
    : (buf) => (fontkit as any).create(buf);

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
    const kit = fontkitCreate(bytes as any);
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
