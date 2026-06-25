import { saveAs } from "file-saver";
import type { CanvasElement, DraftConfig, ExportFormat, PaperConfig } from "@/types";
import { unitToPx } from "@/utils/element";
import { computeLayout } from "./render/layout";
import { renderToCanvas } from "./render/canvas2d";
import { renderPdf, renderRasterPdf } from "./render/pdf";
import { loadFontBundle, degenerateFontProvider, type CustomFontRegistry, type FontBundle } from "./render/fonts";
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

  let bundle: FontBundle | null = null;
  try {
    bundle = await loadFontBundle(customFonts ?? {});
  } catch {
    bundle = null; // 字体加载失败 -> 走光栅兜底
  }
  const provider = bundle ? bundle.provider : degenerateFontProvider();

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

  // PNG / JPG：逐行 canvas → blob → 下载
  const deviceScale = 2;
  for (let i = 0; i < total; i++) {
    const { images, elementImages, draftResolved } = await resolveRowImages(elements, rows[i], draft, resolvePhotoUrl);
    const ops = computeLayout(elements, rows[i], paper, {
      fonts: provider,
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
