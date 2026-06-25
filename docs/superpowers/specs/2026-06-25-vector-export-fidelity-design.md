# 矢量导出保真度重构 — 设计文档

- 日期：2026-06-25
- 分支：`feat/vector-export-fidelity`
- 状态：已确认设计，待写实现计划

## 1. 背景与问题

批量证件设计器导出的 PDF 排版不严格符合编辑器中的设计。根因（已查源码确认）：

导出路径 [`src/utils/export.ts`](../../../src/utils/export.ts) 通过 **html2canvas 1.4.1** 把离屏 DOM 光栅化成位图，再用 jsPDF 把位图塞进 PDF。html2canvas 是一套不完整的 CSS 重新实现，缺失编辑器（真实 Chrome）所依赖的关键特性：

1. **文本垂直居中失效**：设计与导出都用 `display:flex; align-items:center`（[CanvasElement.vue:70](../../../src/components/canvas/CanvasElement.vue#L70)、[export.ts:81](../../../src/utils/export.ts#L81)）做垂直居中。html2canvas 只识别 `display:flex` 关键字，**没有 flex 布局引擎**——`align-items`/`justify-content` 从未被解析或用于定位（grep 源码确认为空）。文字落到框的左上角，凡是框高大于文字高度的，导出后文字偏上。水平方向因额外设了 `text-align`（html2canvas 支持）而正常。
2. **图片 `object-fit` 被忽略**：html2canvas 不支持 `object-fit`（grep 源码为空），`<img>` 被拉伸填满整个框，等比裁剪（cover/contain）失效，照片/头像被压扁拉长。
3. 次要：文字换行点测量、letter-spacing/line-height 的亚像素差异。

工作区当时未提交的改动（`waitForImages`/`waitForFonts`、scale 1.5→2、`formatSize`）是导出质量改进，并非该问题来源；问题是架构性的，根在 html2canvas。

## 2. 目标与非目标

### 目标
- PDF 与 PNG/JPG 导出**严格匹配编辑器设计**：垂直居中、`object-fit`、旋转、不透明度、边框、圆角全部正确。
- PDF 文本为**真实可选中的矢量文字**。
- 根治保真度，而非在 html2canvas 上打补丁。

### 非目标（YAGNI）
- 把编辑器本身切换到 Noto 字体。
- Regular/Bold 之外的字重插值。
- RTL / 竖排文字。
- PDF/A 合规。

## 3. 已确认的关键决策

| 决策点 | 选择 | 理由 |
| --- | --- | --- |
| 导出目标 | 真实矢量 PDF（而非仅光栅"视觉一致"） | 用户要可选中文字 + 矢量清晰度，根治保真度 |
| 字形来源 | **pdf-lib + @pdf-lib/fontkit（子集化）** | 真矢量、仅嵌入用到的字形→小文件、支持 .otf/CFF，CJK 最稳 |
| 光栅范围 | **重建 PNG/JPG 为 Canvas 2D 渲染器** | 三种格式全部与设计一致；Canvas 2D 同时作为 PDF 字体降级兜底 |

### 已接受的取舍
1. **导出对系统字体使用 Noto 替代**（微软雅黑/宋体 → Noto Sans/Serif SC）。位置/排版忠实，字形略有差异；编辑器预览仍显示 OS 字体，故编辑器↔导出字形略有不同，但**位置一致**。
2. **首次导出一次性下载字体**（数 MB OTF），之后浏览器缓存。不进初始包。
3. **引入 vitest** 作为测试运行器（当前项目无测试框架）。

## 4. 架构 — 一个布局核心，两个后端

```
elements + row + paper + fontService
            │
            ▼
   computeLayout()              ← 唯一事实来源（paper-px 坐标系，左上原点，y 向下）
   = 有序 DrawOp[]               (RectOp | TextOp{lines, 逐字 x} | ImageOp{srcRect,dstRect})
            │
     ┌──────┴───────┐
     ▼              ▼
 pdfBackend     canvas2dBackend
 (pdf-lib)      (Canvas 2D)
  PDF 矢量        PNG/JPG 光栅 + PDF 光栅页兜底
```

两个后端消费**同一份** `DrawOp[]`，因此 PNG 与 PDF 像素一致。文本换行/定位在核心中用**嵌入字体的度量（fontkit）测量一次**，两后端都按核心算好的**逐字 x 坐标**绘制（不依赖各自的文字排版），保证定位完全一致。

## 5. 模块划分（新目录 `src/utils/render/`）

### `layout.ts` — 布局核心（纯函数，可单测）
`computeLayout(elements, row, paper, fonts): DrawOp[]`
- 替换 `{{变量}}`、按 zIndex 排序、过滤不可见。
- 负责全部"硬"数学：
  - **文本换行**：在内容区宽度内按字符/空白折行（`white-space: pre-wrap` 语义）。
  - **垂直居中**：文本块高 = 行数 × lineHeightPx；块顶 = 框顶 + (内容区高 − 块高)/2，下限不小于框顶；逐行 baselineY = 块顶 + i×lineHeightPx + ascent（ascent 来自字体度量按字号缩放）。复刻编辑器 flex 居中。
  - **水平对齐**：行宽 = 各字 advance 之和；起始 x = 内容区左 + (内容区宽 − 行宽)×{0|0.5|1}（left/center/right）。
  - **object-fit**：由自然尺寸与目标框算出 (srcRect, dstRect)，覆盖 cover/contain/fill/none/scale-down 五种，均裁剪到框 + 圆角。
  - **旋转**：绕元素中心。
  - **letter-spacing**：逐字 advance = 字体 advance×缩放 + letterSpacingPx（每字后均加，复刻 CSS）。
  - **颜色解析**：`#rgb`/`#rrggbb`/`#rrggbbaa`/`rgb()`/`rgba()`/`transparent`/常用命名 → `{r,g,b,a}`（0–1）；`transparent`/a=0 跳过填充。
  - box-sizing: border-box；内容区 = 框 − 边框 − padding。

### `fonts.ts` — 字体服务
- 懒加载 `public/fonts/` 下的 **Noto Sans SC + Noto Serif SC（Regular/Bold）**（首次导出 fetch，浏览器缓存）。
- 映射：`categorizeFont(fontFamily)` → serif/sans；`fontWeight≥600` → Bold；`italic` → 合成斜切（skew）。
- **自定义上传字体**：注册表（`fontFamily → object URL`）由编排器从 `fontsStore.customFonts` 传入；服务据此 fetch bytes，原样嵌入（同样子集化），role='custom'。
- 对外提供：① 给核心的度量（fontkit：逐字 advanceWidth、ascent/descent、unitsPerEm）；② 给 pdf-lib 的字体 bytes；③ 给 canvas 的 `FontFace`（family 名复用）。
- 解析字体只做一次，pdf-lib 与核心度量共用同一 fontkit 解析结果。

### `pdf.ts` — pdf-lib 后端（矢量 PDF）
- `registerFontkit(fontkit)`；`embedFont(bytes, { subset: true })`。
- 坐标：pdf-lib 原点在**左下角**，需 **y 翻转**（`pageHeightPt − y`）；单位为 pt，需 **mm/px → pt** 换算（1mm = 72/25.4 pt；px 以 96DPI 反推）。
- 绘制：`drawRectangle`（背景/边框/圆角）、`drawImage`（embedPng/embedJpg，按 srcRect 裁剪）、**逐字 `drawText`** 于核心算好的 x/baseline。
- 旋转：用 `pushGraphicsState` + `concatTransformationMatrix`（绕中心 translate→rotate→translate）以与 canvas 完全对齐，而非依赖 drawText 的 rotate 锚点。
- 不透明度：`opacity`/`borderOpacity` 或 GState。
- 单文档多页：每行一页。

### `canvas2d.ts` — Canvas 2D 后端（PNG/JPG + PDF 兜底）
- 每行渲染到 `paper-px × deviceScale` 的 canvas；`toBlob` → PNG/JPG。
- 旋转：`save/translate/rotate/translate/restore`；逐字 `fillText`（baseline=alphabetic，于 baselineY）；`drawImage(img, sx,sy,sw,sh, dx,dy,dw,dh)` 做 object-fit；圆角用 clip path。
- 同一渲染函数产出 PDF 兜底所需的整页位图。

### `export.ts` — 编排器
- 保持现有 `batchExport(elements, rows, paper, options)` 签名与进度回调，仅按 format 路由到后端。
- 底稿背景在两后端中都最先绘制。
- 进度：`onStart/onProgress` 不变。
- 自定义字体注册表（`fontsStore.customFonts` → name/url）作为新增 option 传入，类比现有 `resolvePhotoUrl`。

stores/UI 改动很小：`stores/export.ts` 仅多传"自定义字体注册表"一项；`ExportPanel.vue` 无需改动。

## 6. DrawOp 数据结构（草案）

```ts
type RGBA = { r: number; g: number; b: number; a: number } // 0..1
interface BaseOp { rotationDeg: number; center: { x: number; y: number }; opacity: number }
interface RectOp extends BaseOp { kind: 'rect'; x; y; w; h; fill?: RGBA; borderWidth: number; borderColor?: RGBA; borderRadius: number }
interface ImageOp extends BaseOp { kind: 'image'; dst: Rect; src: Rect; image: ImageSource; borderRadius: number }
interface TextLine { glyphs: { ch: string; x: number }[]; baselineY: number }
interface TextOp extends BaseOp { kind: 'text'; clip: Rect; lines: TextLine[]; fontRef: FontRef; fontSizePx: number; color: RGBA }
type DrawOp = RectOp | ImageOp | TextOp
```

所有坐标在 paper-px、左上原点、y 向下；后端各自转换。

## 7. 错误处理 / 降级
- 绑定字体 fetch 失败 → PDF 改用**光栅页**（canvas2d → `embedPng`），导出仍成功，仅非矢量，并提示警告。
- 图片加载失败 → 跳过该元素（或轻量占位），继续。
- 字形缺失 → Noto CJK 覆盖绝大多数中文；个别缺字渲染为 tofu，不中断。

## 8. 依赖变更
- **新增**：`pdf-lib`、`@pdf-lib/fontkit`、`vitest`。
- **迁移后移除**：`jspdf`、`html2canvas`。
- **新增资源**：Noto Sans/Serif SC（Regular/Bold）放入 `public/fonts/`（懒加载，不进 JS 包）。

## 9. 测试策略
vitest 单测覆盖布局核心这些确定性、易错的数学：
- 单位换算（mm/cm/px ↔ pt/px）。
- object-fit 五种模式的 srcRect/dstRect。
- 文本换行（mock 字体度量）。
- 垂直居中 baseline、水平对齐起点。
- 旋转中心、逐字 x（letter-spacing）。
- 颜色解析各形态。

可视化输出（真实 PDF/PNG 像素）以样例设计手工比对验证。

## 10. 验收标准
1. 一个含"框高>文字、居中文本 + cover 图片 + 旋转元素 + 边框圆角"的样例，导出 PDF 与编辑器视觉一致（文字垂直居中、图片等比裁剪、旋转正确）。
2. PDF 中文字可选中、可复制。
3. PNG/JPG 与 PDF 视觉一致。
4. 同样例导出 PDF 文件体积合理（子集化生效，非每页重复嵌入整套字体）。
5. 布局核心单测通过。
