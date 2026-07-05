"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useWindowManager, WINDOW_DEFAULTS, type WindowId } from "@/components/window-manager-provider"
import { Window } from "@/components/window/window"
import { OverviewWindowContent } from "@/components/window-content/overview-window-content"
import { ChildrenWindowContent } from "@/components/window-content/children-window-content"
import { TasksWindowContent } from "@/components/window-content/tasks-window-content"
import { ReviewWindowContent } from "@/components/window-content/review-window-content"
import { RewardsWindowContent } from "@/components/window-content/rewards-window-content"
import { RedemptionsWindowContent } from "@/components/window-content/redemptions-window-content"

const VALID_WINDOW_IDS = new Set(Object.keys(WINDOW_DEFAULTS))

export default function ParentDesktopPage() {
  const { isHydrated, openWindow } = useWindowManager()
  const router = useRouter()

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("window")
    if (param && VALID_WINDOW_IDS.has(param)) {
      openWindow(param as WindowId)
      router.replace("/parent")
    }
  }, [openWindow, router])

  if (!isHydrated) return null

  return (
    <div className="relative h-full w-full">
      <Window id="overview" title={WINDOW_DEFAULTS.overview.title} className="h-90 w-105">
        <OverviewWindowContent />
      </Window>
      <Window id="children" title={WINDOW_DEFAULTS.children.title} className="h-110 w-95">
        <ChildrenWindowContent />
      </Window>
      <Window id="tasks" title={WINDOW_DEFAULTS.tasks.title} className="h-130 w-180">
        <TasksWindowContent />
      </Window>
      <Window id="review" title={WINDOW_DEFAULTS.review.title} className="h-130 w-140">
        <ReviewWindowContent />
      </Window>
      <Window id="rewards" title={WINDOW_DEFAULTS.rewards.title} className="h-120 w-150">
        <RewardsWindowContent />
      </Window>
      <Window id="redemptions" title={WINDOW_DEFAULTS.redemptions.title} className="h-120 w-170">
        <RedemptionsWindowContent />
      </Window>
    </div>
  )
}
