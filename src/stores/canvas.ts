import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  CanvasElement,
  DraftConfig,
  ImageElement,
  PaperConfig,
  TextElement,
} from "@/types";
import {
  createDefaultPaper,
  createImageElement,
  createTextElement,
  sortByZIndex,
} from "@/utils/element";
import type { TemplateConfig } from "@/data/templates";

// 画布 Store：管理元素、稿纸配置、缩放与选中状态
export const useCanvasStore = defineStore("canvas", () => {
  const elements = ref<CanvasElement[]>([]);
  const selectedId = ref<string | null>(null);
  const paper = ref<PaperConfig>(createDefaultPaper());
  const zoom = ref(1);
  const minZoom = 0.2;
  const maxZoom = 4;
  const draft = ref<DraftConfig | null>(null);

  const selectedElement = computed<CanvasElement | null>(() => {
    if (!selectedId.value) return null;
    return elements.value.find((el) => el.id === selectedId.value) ?? null;
  });

  const sortedElements = computed(() => sortByZIndex(elements.value));
  const maxZIndex = computed(() =>
    elements.value.reduce((max, el) => Math.max(max, el.zIndex), 0),
  );

  // 添加文本元素
  function addTextElement(
    partial: Partial<Omit<TextElement, "id" | "type">> = {},
  ): TextElement {
    const el = createTextElement({
      zIndex: maxZIndex.value + 1,
      ...partial,
    });
    elements.value.push(el);
    selectedId.value = el.id;
    return el;
  }

  // 添加图片元素
  function addImageElement(
    partial: Partial<Omit<ImageElement, "id" | "type">> = {},
  ): ImageElement {
    const el = createImageElement({
      zIndex: maxZIndex.value + 1,
      ...partial,
    });
    elements.value.push(el);
    selectedId.value = el.id;
    return el;
  }

  // 更新元素属性
  function updateElement(id: string, patch: Partial<CanvasElement>): void {
    const index = elements.value.findIndex((el) => el.id === id);
    if (index === -1) return;
    elements.value[index] = {
      ...elements.value[index],
      ...patch,
    } as CanvasElement;
  }

  // 删除元素
  function removeElement(id: string): void {
    const index = elements.value.findIndex((el) => el.id === id);
    if (index === -1) return;
    elements.value.splice(index, 1);
    if (selectedId.value === id) selectedId.value = null;
  }

  // 选中元素
  function selectElement(id: string | null): void {
    selectedId.value = id;
  }

  // 置顶
  function bringToFront(id: string): void {
    updateElement(id, { zIndex: maxZIndex.value + 1 });
  }

  // 置底
  function sendToBack(id: string): void {
    updateElement(id, { zIndex: 0 });
  }

  // 复制元素
  function duplicateElement(id: string): void {
    const source = elements.value.find((el) => el.id === id);
    if (!source) return;
    const clone = {
      ...source,
      id: `${source.id}_copy_${Math.random().toString(36).slice(2, 7)}`,
      x: source.x + 20,
      y: source.y + 20,
      zIndex: maxZIndex.value + 1,
    };
    elements.value.push(clone);
    selectedId.value = clone.id;
  }

  // 清空所有元素
  function clearElements(): void {
    elements.value = [];
    selectedId.value = null;
  }

  // 设置缩放
  function setZoom(value: number): void {
    zoom.value = Math.max(minZoom, Math.min(maxZoom, value));
  }

  // 放大
  function zoomIn(): void {
    setZoom(zoom.value + 0.1);
  }

  // 缩小
  function zoomOut(): void {
    setZoom(zoom.value - 0.1);
  }

  // 重置缩放
  function resetZoom(): void {
    zoom.value = 1;
  }

  // 更新稿纸配置
  function updatePaper(patch: Partial<PaperConfig>): void {
    paper.value = { ...paper.value, ...patch };
  }

  // 设置底稿
  function setDraft(config: DraftConfig | null): void {
    draft.value = config;
  }

  // 清除底稿
  function clearDraft(): void {
    draft.value = null;
  }

  // 加载模板
  function loadTemplate(template: TemplateConfig): void {
    // 清空现有元素
    elements.value = [];
    selectedId.value = null;

    // 设置稿纸配置
    paper.value = { ...template.paper };

    // 设置底稿
    draft.value = template.draft ? { ...template.draft } : null;

    // 添加模板元素（深拷贝）
    elements.value = template.elements.map((el) => ({ ...el }));
  }

  return {
    elements,
    selectedId,
    paper,
    zoom,
    minZoom,
    maxZoom,
    draft,
    selectedElement,
    sortedElements,
    maxZIndex,
    addTextElement,
    addImageElement,
    updateElement,
    removeElement,
    selectElement,
    bringToFront,
    sendToBack,
    duplicateElement,
    clearElements,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    updatePaper,
    setDraft,
    clearDraft,
    loadTemplate,
  };
});
