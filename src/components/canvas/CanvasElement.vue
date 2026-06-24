<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import { useCanvasStore } from "@/stores/canvas";
import { useExcelStore } from "@/stores/excel";
import { usePhotosStore } from "@/stores/photos";
import type { CanvasElement } from "@/types";
import { interpolateContent } from "@/utils/element";

const props = defineProps<{
  element: CanvasElement;
}>();

const canvasStore = useCanvasStore();
const excelStore = useExcelStore();
const photosStore = usePhotosStore();

const isSelected = computed(() => canvasStore.selectedId === props.element.id);

// 渲染时的文本内容（替换变量）
const displayContent = computed(() => {
  if (props.element.type !== "text") return "";
  const row = excelStore.currentRow ?? {};
  return interpolateContent(props.element.content, row);
});

// 动态图片的实际显示 URL
const dynamicImageSrc = computed(() => {
  if (props.element.type !== "image") return "";
  if (props.element.srcType === "static") return props.element.src;
  const row = excelStore.currentRow ?? {};
  return photosStore.resolvePhotoUrl(props.element.pathTemplate, row);
});

// 元素样式
const elementStyle = computed<CSSProperties>(() => {
  const el = props.element;
  const base: CSSProperties = {
    position: "absolute",
    left: `${el.x}px`,
    top: `${el.y}px`,
    width: typeof el.width === "number" ? `${el.width}px` : el.width,
    height: typeof el.height === "number" ? `${el.height}px` : el.height,
    transform: `rotate(${el.rotation}deg)`,
    opacity: el.opacity,
    zIndex: el.zIndex,
    cursor: el.locked ? "default" : "move",
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
});

// 拖拽逻辑
const dragging = ref(false);
let startX = 0;
let startY = 0;
let originX = 0;
let originY = 0;

// 文本双击编辑
const editing = ref(false);
const editText = ref("");
const editRef = ref<HTMLTextAreaElement | null>(null);

function handleDoubleClick(event: MouseEvent): void {
  if (props.element.locked) return;
  if (props.element.type !== "text") return;
  event.stopPropagation();
  event.preventDefault();
  editing.value = true;
  editText.value = props.element.content;
  // 下一帧聚焦 textarea 并选中全部内容
  requestAnimationFrame(() => {
    editRef.value?.focus();
    editRef.value?.select();
  });
}

function commitEdit(): void {
  if (!editing.value) return;
  editing.value = false;
  if (
    props.element.type === "text" &&
    editText.value !== props.element.content
  ) {
    canvasStore.updateElement(props.element.id, { content: editText.value });
  }
}

function cancelEdit(): void {
  editing.value = false;
}

function handleEditKeydown(event: KeyboardEvent): void {
  // Esc 退出编辑不保存
  if (event.key === "Escape") {
    event.preventDefault();
    cancelEdit();
    return;
  }
  // Enter（无 Shift）退出编辑并保存
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    commitEdit();
  }
}

function handleMouseDown(event: MouseEvent): void {
  if (props.element.locked) return;
  if (event.button !== 0) return;
  event.stopPropagation();
  canvasStore.selectElement(props.element.id);

  startX = event.clientX;
  startY = event.clientY;
  originX = props.element.x;
  originY = props.element.y;
  dragging.value = true;

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
}

function handleMouseMove(event: MouseEvent): void {
  if (!dragging.value) return;
  const dx = (event.clientX - startX) / canvasStore.zoom;
  const dy = (event.clientY - startY) / canvasStore.zoom;
  canvasStore.updateElement(props.element.id, {
    x: Math.round(originX + dx),
    y: Math.round(originY + dy),
  });
}

function handleMouseUp(): void {
  dragging.value = false;
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
}

// 缩放手柄拖拽
type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

let resizeStart = {
  x: 0,
  y: 0,
  elX: 0,
  elY: 0,
  elW: 0,
  elH: 0,
};

function handleResizeStart(event: MouseEvent, handle: ResizeHandle): void {
  if (props.element.locked) return;
  event.stopPropagation();
  event.preventDefault();

  resizeStart = {
    x: event.clientX,
    y: event.clientY,
    elX: props.element.x,
    elY: props.element.y,
    elW: props.element.width,
    elH: props.element.height,
  };

  const onMove = (e: MouseEvent) => handleResizeMove(e, handle);
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function handleResizeMove(event: MouseEvent, handle: ResizeHandle): void {
  // 当 width/height 是字符串（如 'auto'、'100%'）时，禁止缩放
  if (typeof props.element.width === "string" || typeof props.element.height === "string") {
    return;
  }
  const dx = (event.clientX - resizeStart.x) / canvasStore.zoom;
  const dy = (event.clientY - resizeStart.y) / canvasStore.zoom;
  const { elX, elY, elW, elH } = resizeStart;

  let newX = elX;
  let newY = elY;
  let newW = elW;
  let newH = elH;

  if (handle.includes("e")) newW = Math.max(10, elW + dx);
  if (handle.includes("s")) newH = Math.max(10, elH + dy);
  if (handle.includes("w")) {
    newW = Math.max(10, elW - dx);
    newX = elX + (elW - newW);
  }
  if (handle.includes("n")) {
    newH = Math.max(10, elH - dy);
    newY = elY + (elH - newH);
  }

  canvasStore.updateElement(props.element.id, {
    x: Math.round(newX),
    y: Math.round(newY),
    width: Math.round(newW),
    height: Math.round(newH),
  });
}
</script>

<template>
  <div
    class="canvas-element"
    :class="{ selected: isSelected, dragging }"
    :style="elementStyle"
    @mousedown="handleMouseDown"
    @click.stop="canvasStore.selectElement(element.id)"
    @dblclick="handleDoubleClick"
  >
    <!-- 文本元素内容 -->
    <template v-if="element.type === 'text'">
      <textarea
        v-if="editing"
        ref="editRef"
        v-model="editText"
        class="element-edit-textarea"
        :style="{
          color: element.color,
          fontFamily: element.fontFamily,
          fontSize: element.fontSize + 'px',
          fontWeight: String(element.fontWeight),
          fontStyle: element.fontStyle,
          textAlign: element.textAlign,
          lineHeight: String(element.lineHeight),
          letterSpacing: element.letterSpacing + 'px',
          padding: element.padding + 'px',
        }"
        @blur="commitEdit"
        @keydown="handleEditKeydown"
        @mousedown.stop
        @click.stop
      />
      <template v-else>
        {{ displayContent }}
      </template>
    </template>

    <!-- 图片元素内容 -->
    <template v-else-if="element.type === 'image'">
      <img
        v-if="dynamicImageSrc"
        :src="dynamicImageSrc"
        class="element-image"
        :style="{ objectFit: element.fit }"
        draggable="false"
      >
      <div
        v-else
        class="image-placeholder"
        :class="{ 'dynamic-placeholder': element.srcType === 'dynamic' }"
      >
        <template v-if="element.srcType === 'dynamic'">
          <div class="placeholder-icon">
            ⚙
          </div>
          <div class="placeholder-text">
            动态图片
          </div>
          <div
            v-if="element.pathTemplate"
            class="placeholder-path"
          >
            {{ element.pathTemplate }}
          </div>
        </template>
        <template v-else>
          <span>图片占位</span>
        </template>
      </div>
    </template>

    <!-- 选中时显示的缩放手柄 -->
    <template v-if="isSelected && !element.locked">
      <span
        v-for="h in [
          'nw',
          'n',
          'ne',
          'e',
          'se',
          's',
          'sw',
          'w',
        ] as ResizeHandle[]"
        :key="h"
        class="resize-handle"
        :class="`handle-${h}`"
        @mousedown="handleResizeStart($event, h)"
      />
    </template>
  </div>
</template>

<style scoped>
.canvas-element {
  user-select: none;
}

.canvas-element.selected {
  outline: 2px solid var(--color-primary);
  outline-offset: 0;
}

.canvas-element.dragging {
  opacity: 0.8;
}

.element-edit-textarea {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
}

.element-image {
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.image-placeholder.dynamic-placeholder {
  flex-direction: column;
  gap: 4px;
  background-color: #eff6ff;
  border: 2px dashed #93c5fd;
  color: #3b82f6;
  padding: 8px;
  text-align: center;
}

.placeholder-icon {
  font-size: 18px;
}

.placeholder-text {
  font-size: 12px;
  font-weight: 600;
}

.placeholder-path {
  font-size: 10px;
  font-family: var(--font-mono, monospace);
  color: #6b7280;
  word-break: break-all;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: #fff;
  border: 1px solid var(--color-primary);
  border-radius: 50%;
  z-index: 10;
}

.handle-nw {
  top: -4px;
  left: -4px;
  cursor: nwse-resize;
}

.handle-n {
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.handle-ne {
  top: -4px;
  right: -4px;
  cursor: nesw-resize;
}

.handle-e {
  top: 50%;
  right: -4px;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.handle-se {
  bottom: -4px;
  right: -4px;
  cursor: nwse-resize;
}

.handle-s {
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.handle-sw {
  bottom: -4px;
  left: -4px;
  cursor: nesw-resize;
}

.handle-w {
  top: 50%;
  left: -4px;
  transform: translateY(-50%);
  cursor: ew-resize;
}
</style>
