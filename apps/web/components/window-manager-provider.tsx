"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useAuth } from "@/components/auth-provider"

export type WindowId = "overview" | "children" | "tasks" | "review" | "rewards" | "redemptions"

export interface WindowPosition {
  x: number
  y: number
}

export interface WindowState {
  open: boolean
  minimized: boolean
  position: WindowPosition
  zIndex: number
}

type WindowsState = Record<WindowId, WindowState>

export const WINDOW_IDS: WindowId[] = ["overview", "children", "tasks", "review", "rewards", "redemptions"]

export const WINDOW_DEFAULTS: Record<WindowId, { title: string; position: WindowPosition }> = {
  overview: { title: "Overview", position: { x: 40, y: 24 } },
  children: { title: "Children", position: { x: 460, y: 64 } },
  tasks: { title: "Tasks", position: { x: 140, y: 220 } },
  review: { title: "Review Queue", position: { x: 520, y: 260 } },
  rewards: { title: "Rewards", position: { x: 200, y: 420 } },
  redemptions: { title: "Redemptions", position: { x: 580, y: 460 } },
}

function buildDefaultWindows(): WindowsState {
  const windows = {} as WindowsState
  WINDOW_IDS.forEach((id, i) => {
    windows[id] = {
      open: id === "overview",
      minimized: false,
      position: WINDOW_DEFAULTS[id].position,
      zIndex: i + 1,
    }
  })
  return windows
}

interface WindowManagerContextValue {
  windows: WindowsState
  isHydrated: boolean
  openWindow: (id: WindowId) => void
  closeWindow: (id: WindowId) => void
  minimizeWindow: (id: WindowId) => void
  restoreWindow: (id: WindowId) => void
  focusWindow: (id: WindowId) => void
  moveWindow: (id: WindowId, position: WindowPosition) => void
}

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null)

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [windows, setWindows] = useState<WindowsState>(buildDefaultWindows)
  const [isHydrated, setIsHydrated] = useState(false)
  const nextZIndex = useRef(WINDOW_IDS.length + 1)
  const writeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    const key = `c4t.windows.${user.familyId}.${user.userId}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Record<WindowId, WindowState>>
        const merged = buildDefaultWindows()
        let maxZ = WINDOW_IDS.length
        WINDOW_IDS.forEach((id) => {
          const s = saved[id]
          if (s) {
            merged[id] = { ...merged[id], ...s }
            maxZ = Math.max(maxZ, s.zIndex ?? 0)
          }
        })
        nextZIndex.current = maxZ + 1
        setWindows(merged)
      }
    } catch {
      // corrupt/missing storage — fall back to defaults already in state
    }
    setIsHydrated(true)
  }, [user])

  useEffect(() => {
    if (!isHydrated || !user) return
    const key = `c4t.windows.${user.familyId}.${user.userId}`
    if (writeTimeout.current) clearTimeout(writeTimeout.current)
    writeTimeout.current = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(windows))
    }, 300)
    return () => {
      if (writeTimeout.current) clearTimeout(writeTimeout.current)
    }
  }, [windows, isHydrated, user])

  const focusWindow = useCallback((id: WindowId) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], zIndex: nextZIndex.current++ } }))
  }, [])

  const openWindow = useCallback((id: WindowId) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], open: true, minimized: false, zIndex: nextZIndex.current++ } }))
  }, [])

  const closeWindow = useCallback((id: WindowId) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], open: false, minimized: false } }))
  }, [])

  const minimizeWindow = useCallback((id: WindowId) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], minimized: true } }))
  }, [])

  const restoreWindow = useCallback((id: WindowId) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], minimized: false, zIndex: nextZIndex.current++ } }))
  }, [])

  const moveWindow = useCallback((id: WindowId, position: WindowPosition) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], position } }))
  }, [])

  return (
    <WindowManagerContext.Provider
      value={{ windows, isHydrated, openWindow, closeWindow, minimizeWindow, restoreWindow, focusWindow, moveWindow }}
    >
      {children}
    </WindowManagerContext.Provider>
  )
}

export function useWindowManager(): WindowManagerContextValue {
  const ctx = useContext(WindowManagerContext)
  if (!ctx) throw new Error("useWindowManager must be used within WindowManagerProvider")
  return ctx
}
