"use client"

import { useEffect, useRef } from "react"
import { MinusCircleIcon, XCircleIcon } from "@phosphor-icons/react"
import { cn } from "@workspace/ui/lib/utils"
import { useWindowManager, type WindowId, type WindowPosition } from "@/components/window-manager-provider"
import { useDraggable } from "@/components/window/use-draggable"

interface WindowProps {
  id: WindowId
  title: string
  className?: string
  children: React.ReactNode
}

function clampToCanvas(position: WindowPosition, el: HTMLElement): WindowPosition {
  const canvas = el.offsetParent as HTMLElement | null
  if (!canvas) return position
  const maxX = Math.max(canvas.clientWidth - el.offsetWidth, 0)
  const maxY = Math.max(canvas.clientHeight - el.offsetHeight, 0)
  return {
    x: Math.min(Math.max(position.x, 0), maxX),
    y: Math.min(Math.max(position.y, 0), maxY),
  }
}

export function Window({ id, title, className, children }: WindowProps) {
  const { windows, focusWindow, minimizeWindow, closeWindow, moveWindow } = useWindowManager()
  const state = windows[id]
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { handleProps, isDragging } = useDraggable({
    position: state.position,
    onMove: (position) => {
      const el = wrapperRef.current
      moveWindow(id, el ? clampToCanvas(position, el) : position)
    },
    onDragStart: () => focusWindow(id),
  })

  useEffect(() => {
    if (!state.open) return
    const el = wrapperRef.current
    if (!el) return
    const clamped = clampToCanvas(state.position, el)
    if (clamped.x !== state.position.x || clamped.y !== state.position.y) {
      moveWindow(id, clamped)
    }
    // Only re-clamp when a window opens/restores — not on every position/state.position change (would fight the drag handler).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open])

  if (!state.open) return null

  return (
    <div
      ref={wrapperRef}
      className={cn("absolute flex flex-col items-start gap-2", state.minimized && "hidden")}
      style={{ transform: `translate(${state.position.x}px, ${state.position.y}px)`, zIndex: state.zIndex }}
      onPointerDownCapture={() => focusWindow(id)}
    >
      <div className="flex items-center gap-1 rounded-full border bg-background px-1 py-0.5 shadow-sm">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            closeWindow(id)
          }}
          className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label={`Close ${title}`}
        >
          <XCircleIcon className="size-5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            minimizeWindow(id)
          }}
          className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label={`Minimize ${title}`}
        >
          <MinusCircleIcon className="size-5" />
        </button>
      </div>

      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10",
          className,
        )}
      >
        <div
          {...handleProps}
          className={cn(
            "shrink-0 touch-none rounded-t-xl border-b px-4 py-2 text-sm font-medium select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          {title}
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    </div>
  )
}
