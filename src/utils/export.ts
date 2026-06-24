import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { saveAs } from "file-saver";
import type { CanvasElement, DraftConfig, ExportFormat, PaperConfig } from "@/types";
import { interpolateContent, unitToPx } from "@/utils/element";

// 渲染单个元素为内联样式对象（用于离屏渲染）
export function renderElementStyle(
  el: CanvasElement,
  _row: Record<string, string>,
): Record<string, string> {
  const base: Record<string, string> = {
    position: "absolute",
    left: `${el.x}px`,
    top: `${el.y}px`,
    width: `${el.width}px`,
    height: `${el.height}px`,
    transform: `rotate(${el.rotation}deg)`,
    opacity: String(el.opacity),
    zIndex: String(el.zIndex),
    boxSizing: "border-box",
  };

  if (el.type === "text") {
    return {
      ...base,
      color: el.color,
      fontFamily: el.fontFamily,
      fontSize: `${el.fontSize}px`,
      fontWeight: String(el.fontWeight),
      fontStyle: el.fontStyle,
      textAlign: el.textAlign,
      lineHeight: String(el.lineHeight),
      letterSpacing: `${el.letterSpacing}px`,
      backgroundColor: el.backgroundColor,
      borderWidth: `${el.borderWidth}px`,
      borderStyle: el.borderWidth > 0 ? "solid" : "none",
      borderColor: el.borderColor,
      borderRadius: `${el.borderRadius}px`,
      padding: `${el.padding}px`,
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      display: "flex",
      alignItems: "center",
      justifyContent:
        el.textAlign === "center"
          ? "center"
          : el.textAlign === "right"
            ? "flex-end"
            : "flex-start",
    };
  }

  return {
    ...base,
    backgroundColor: el.backgroundColor,
    borderRadius: `${el.borderRadius}px`,
    borderWidth: `${el.borderWidth}px`,
    borderStyle: el.borderWidth > 0 ? "solid" : "none",
    borderColor: el.borderColor,
    overflow: "hidden",
  };
}

// 渲染元素内容（替换变量）
export function renderElementContent(
  el: CanvasElement,
  row: Record<string, string>,
): string {
  if (el.type === "text") {
    return interpolateContent(el.content, row);
  }
  return "";
}

// 构建离屏渲染的 DOM 节点
function buildOffscreenNode(
  elements: CanvasElement[],
  row: Record<string, string>,
  paper: PaperConfig,
  scale: number,
  draft: DraftConfig | null,
): HTMLElement {
  const widthPx = unitToPx(paper.width, paper.unit);
  const heightPx = unitToPx(paper.height, paper.unit);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = `${widthPx}px`;
  container.style.height = `${heightPx}px`;
  container.style.backgroundColor = paper.backgroundColor;
  container.style.overflow = "hidden";
  container.style.transformOrigin = "top left";
  container.style.transform = `scale(${scale})`;

  // 添加底稿图片
  if (draft) {
    const draftNode = document.createElement("img");
    draftNode.src = draft.src;
    draftNode.style.position = "absolute";
    draftNode.style.left = "0";
    draftNode.style.top = "0";
    draftNode.style.width = `${widthPx}px`;
    draftNode.style.height = `${heightPx}px`;
    draftNode.style.opacity = String(draft.opacity);
    draftNode.style.pointerEvents = "none";
    draftNode.style.zIndex = "0";
    container.appendChild(draftNode);
  }

  const sorted = [...elements]
    .filter((el) => el.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const el of sorted) {
    const node = document.createElement("div");
    const style = renderElementStyle(el, row);
    for (const [key, value] of Object.entries(style)) {
      node.style.setProperty(key, value);
    }

    if (el.type === "text") {
      node.textContent = renderElementContent(el, row);
    } else if (el.type === "image" && el.src) {
      const img = document.createElement("img");
      img.src = el.src;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = el.fit;
      node.appendChild(img);
    }

    container.appendChild(node);
  }

  document.body.appendChild(container);
  return container;
}

// 导出单页为图片 DataURL
async function exportNodeToImage(
  node: HTMLElement,
  format: ExportFormat,
  quality: number,
): Promise<string> {
  const canvas = await html2canvas(node, {
    backgroundColor: null,
    scale: 1.5,
    useCORS: true,
    logging: false,
  });
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  return canvas.toDataURL(mime, quality);
}

// 导出单页为 Blob（避免 base64 字符串转换）
async function exportNodeToBlob(
  node: HTMLElement,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const canvas = await html2canvas(node, {
    backgroundColor: null,
    scale: 1.5,
    useCORS: true,
    logging: false,
  });
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob 返回空值"));
      },
      mime,
      quality,
    );
  });
}

// 批量导出
export async function batchExport(
  elements: CanvasElement[],
  rows: Record<string, string>[],
  paper: PaperConfig,
  options: {
    format: ExportFormat;
    quality: number;
    fileName: string;
    draft: DraftConfig | null;
    onStart?: (total: number) => void;
    onProgress?: (current: number, total: number) => void;
  },
): Promise<void> {
  const { format, quality, fileName, draft, onStart, onProgress } = options;
  const total = rows.length;
  onStart?.(total);

  // DOM 层面不缩放，由 html2canvas 的 scale 参数控制分辨率
  const scale = 1;

  if (format === "pdf") {
    const pdf = new jsPDF({
      orientation: paper.orientation,
      unit: paper.unit,
      format: [paper.width, paper.height],
      compress: true,
    });

    for (let i = 0; i < total; i++) {
      const node = buildOffscreenNode(elements, rows[i], paper, scale, draft);
      try {
        // PDF 内部使用 JPEG 格式，体积远小于 PNG，避免字符串超长
        const dataUrl = await exportNodeToImage(node, "jpg", quality);
        if (i > 0) pdf.addPage([paper.width, paper.height], paper.orientation);
        pdf.addImage(
          dataUrl,
          "JPEG",
          0,
          0,
          paper.width,
          paper.height,
          undefined,
          "FAST",
        );
      } finally {
        document.body.removeChild(node);
      }
      onProgress?.(i + 1, total);
    }

    // 使用 output('blob') + saveAs 替代 pdf.save()，避免字符串拼接超限
    const blob = pdf.output("blob");
    saveAs(blob, `${fileName}.pdf`);
    return;
  }

  // 图片格式：每行导出一张，逐张下载
  for (let i = 0; i < total; i++) {
    const node = buildOffscreenNode(elements, rows[i], paper, scale, draft);
    try {
      const blob = await exportNodeToBlob(node, format, quality);
      saveAs(blob, `${fileName}_${i + 1}.${format}`);
    } finally {
      document.body.removeChild(node);
    }
    onProgress?.(i + 1, total);
  }
}

// 导出当前预览页为单张图片（用于快速预览）
export async function exportPreview(
  node: HTMLElement,
  format: ExportFormat,
  quality: number,
): Promise<string> {
  const canvas = await html2canvas(node, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  return canvas.toDataURL(mime, quality);
}

// 计算稿纸像素尺寸
export function getPaperPixelSize(paper: PaperConfig): {
  width: number;
  height: number;
} {
  return {
    width: unitToPx(paper.width, paper.unit),
    height: unitToPx(paper.height, paper.unit),
  };
}
