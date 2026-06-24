<script setup lang="ts">
import { ref } from 'vue'
import { usePhotosStore } from '@/stores/photos'
import type { PhotoItem } from '@/types'

const photosStore = usePhotosStore()
const folderInput = ref<HTMLInputElement | null>(null)
const filesInput = ref<HTMLInputElement | null>(null)
const previewPhoto = ref<PhotoItem | null>(null)

// 触发文件夹选择
function triggerFolderUpload(): void {
  folderInput.value?.click()
}

// 触发文件选择
function triggerFilesUpload(): void {
  filesInput.value?.click()
}

// 处理文件夹上传
function handleFolderUpload(event: Event): void {
  const target = event.target as HTMLInputElement
  if (!target.files) return
  photosStore.uploadPhotos(target.files)
  target.value = ''
}

// 处理文件上传
function handleFilesUpload(event: Event): void {
  const target = event.target as HTMLInputElement
  if (!target.files) return
  photosStore.uploadPhotos(target.files)
  target.value = ''
}

// 预览照片
function preview(photo: PhotoItem): void {
  previewPhoto.value = photo
}

// 关闭预览
function closePreview(): void {
  previewPhoto.value = null
}
</script>

<template>
  <div class="photo-library">
    <div class="panel-section">
      <h3 class="panel-title">
        照片库
      </h3>
      <p class="section-hint">
        本地临时存储，不上传到服务器
      </p>

      <div class="upload-buttons">
        <button
          class="btn btn-primary btn-sm btn-block"
          @click="triggerFolderUpload"
        >
          选择照片文件夹
        </button>
        <input
          ref="folderInput"
          type="file"
          accept="image/*"
          multiple
          webkitdirectory
          style="display: none"
          @change="handleFolderUpload"
        >
        <button
          class="btn btn-default btn-sm btn-block"
          @click="triggerFilesUpload"
        >
          选择照片文件
        </button>
        <input
          ref="filesInput"
          type="file"
          accept="image/*"
          multiple
          style="display: none"
          @change="handleFilesUpload"
        >
      </div>

      <div
        v-if="photosStore.hasPhotos"
        class="photo-count"
      >
        共 {{ photosStore.totalPhotos }} 张照片
        <button
          class="link-btn"
          @click="photosStore.clearPhotos"
        >
          清空
        </button>
      </div>
    </div>

    <div
      v-if="photosStore.hasPhotos"
      class="panel-section photo-list-section"
    >
      <h3 class="panel-title">
        照片列表
      </h3>
      <div class="photo-grid">
        <div
          v-for="photo in photosStore.photos"
          :key="photo.path"
          class="photo-item"
          :title="photo.path"
          @click="preview(photo)"
        >
          <img
            :src="photo.url"
            :alt="photo.name"
          >
          <div class="photo-name">
            {{ photo.name }}
          </div>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <div
      v-if="previewPhoto"
      class="preview-modal"
      @click.self="closePreview"
    >
      <div class="preview-content">
        <img
          :src="previewPhoto.url"
          :alt="previewPhoto.name"
        >
        <div class="preview-info">
          <div class="preview-path">
            {{ previewPhoto.path }}
          </div>
          <button
            class="btn btn-default btn-sm"
            @click="closePreview"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-library {
  width: 100%;
}

.upload-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-block {
  width: 100%;
}

.photo-count {
  margin-top: 10px;
  padding: 6px 10px;
  background-color: #f9fafb;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.link-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.link-btn:hover {
  text-decoration: underline;
}

.photo-list-section {
  max-height: 300px;
  overflow-y: auto;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.photo-item {
  cursor: pointer;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background-color: #f3f4f6;
  transition: transform 0.15s ease;
}

.photo-item:hover {
  transform: scale(1.05);
}

.photo-item img {
  width: 100%;
  height: 60px;
  object-fit: cover;
  display: block;
}

.photo-name {
  padding: 4px;
  font-size: 10px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgb(0 0 0 / 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.preview-content {
  max-width: 90vw;
  max-height: 90vh;
  background-color: #fff;
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-content img {
  max-width: 80vw;
  max-height: 70vh;
  object-fit: contain;
}

.preview-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.preview-path {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
