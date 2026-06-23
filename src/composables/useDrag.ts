import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

// 拖拽状态
interface DragState {
  startX: number
  startY: number
  originX: number
  originY: number
}

// 通用拖拽 composable，返回正在拖拽标志
export function useDrag(
  target: Ref<HTMLElement | null>,
  options: {
    onMove: (dx: number, dy: number, state: DragState) => void
    onStart?: (state: DragState) => void
    onEnd?: () => void
  },
) {
  const dragging = ref(false)
  let state: DragState | null = null

  function handleMouseDown(event: MouseEvent): void {
    if (!target.value) return
    // 仅响应左键
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const rect = target.value.getBoundingClientRect()
    state = {
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
    }
    dragging.value = true
    options.onStart?.(state)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!state) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    options.onMove(dx, dy, state)
  }

  function handleMouseUp(): void {
    dragging.value = false
    state = null
    options.onEnd?.()
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  onMounted(() => {
    target.value?.addEventListener('mousedown', handleMouseDown)
  })

  onBeforeUnmount(() => {
    target.value?.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  })

  return { dragging }
}
