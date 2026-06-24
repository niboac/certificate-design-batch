import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PhotoItem } from '@/types'

// 照片管理 Store：本地临时存储上传的照片，不上传到服务器
export const usePhotosStore = defineStore('photos', () => {
  const photos = ref<PhotoItem[]>([])

  const hasPhotos = computed(() => photos.value.length > 0)
  const totalPhotos = computed(() => photos.value.length)

  // 根据路径查找照片
  function findPhotoByPath(path: string): PhotoItem | undefined {
    return photos.value.find(
      (p) => p.path === path || p.name === path,
    )
  }

  // 批量上传照片（支持文件夹选择）
  async function uploadPhotos(files: FileList | File[]): Promise<void> {
    const fileArray = Array.from(files)
    const imageFiles = fileArray.filter((file) =>
      file.type.startsWith('image/'),
    )

    for (const file of imageFiles) {
      const url = URL.createObjectURL(file)
      // webkitRelativePath 表示相对路径（文件夹选择时）
      const path = (file as File & { webkitRelativePath?: string })
        .webkitRelativePath || file.name
      photos.value.push({
        name: file.name,
        path,
        url,
      })
    }
  }

  // 移除单张照片
  function removePhoto(path: string): void {
    const index = photos.value.findIndex((p) => p.path === path)
    if (index !== -1) {
      URL.revokeObjectURL(photos.value[index].url)
      photos.value.splice(index, 1)
    }
  }

  // 清空所有照片
  function clearPhotos(): void {
    for (const photo of photos.value) {
      URL.revokeObjectURL(photo.url)
    }
    photos.value = []
  }

  // 根据路径模板和数据行解析实际图片 URL
  function resolvePhotoUrl(
    pathTemplate: string,
    row: Record<string, string>,
  ): string {
    const resolvedPath = pathTemplate.replace(
      /\{\{\s*([^}]+?)\s*\}\}/g,
      (_match, key: string) => {
        return row[key.trim()] ?? ''
      },
    )
    const photo = findPhotoByPath(resolvedPath)
    return photo?.url ?? ''
  }

  return {
    photos,
    hasPhotos,
    totalPhotos,
    findPhotoByPath,
    uploadPhotos,
    removePhoto,
    clearPhotos,
    resolvePhotoUrl,
  }
})
