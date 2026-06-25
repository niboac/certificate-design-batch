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
