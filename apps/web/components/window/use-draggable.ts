"use client"

import { useCallback, useRef, useState } from "react"
import type { WindowPosition } from "@/components/window-manager-provider"

interface UseDraggableOptions {
  position: WindowPosition
  onMove: (position: WindowPosition) => void
  onDragStart?: () => void
}

interface DragOrigin {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

export function useDraggable({ position, onMove, onDragStart }: UseDraggableOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const dragOrigin = useRef<DragOrigin | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      dragOrigin.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: position.x,
        originY: position.y,
      }
      setIsDragging(true)
      onDragStart?.()
    },
    [position, onDragStart],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const origin = dragOrigin.current
      if (!origin) return
      onMove({
        x: origin.originX + (e.clientX - origin.startX),
        y: origin.originY + (e.clientY - origin.startY),
      })
    },
    [onMove],
  )

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (dragOrigin.current) {
      e.currentTarget.releasePointerCapture(dragOrigin.current.pointerId)
    }
    dragOrigin.current = null
    setIsDragging(false)
  }, [])

  return {
    isDragging,
    handleProps: { onPointerDown, onPointerMove, onPointerUp },
  }
}
