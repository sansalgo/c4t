"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Hourglass, Gift, Users } from "@phosphor-icons/react"
import { TaskStatus } from "@workspace/types"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { useWindowManager, type WindowId } from "@/components/window-manager-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

interface Member { id: string; userId: string; role: string }
interface Task { id: string; title: string; status: string; dueAt?: string }

function StatCard({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  onClick: () => void
}) {
  return (
    <Card className="hover:bg-accent/50 cursor-pointer transition-colors" onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

export function OverviewWindowContent() {
  const { user } = useAuth()
  const { openWindow } = useWindowManager()
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const familyId = user?.familyId

  useEffect(() => {
    if (!familyId) return
    Promise.all([
      api.get<Member[]>(`/families/${familyId}/members`),
      api.get<Task[]>(`/families/${familyId}/tasks`),
    ])
      .then(([m, t]) => {
        setMembers(m)
        setTasks(t)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [familyId])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  const children = members.filter((m) => m.role === "CHILD")
  const pendingReview = tasks.filter((t) => t.status === TaskStatus.PENDING_REVIEW)
  const goTo = (id: WindowId) => () => openWindow(id)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Children" value={children.length} onClick={goTo("children")} />
        <StatCard icon={Hourglass} label="Pending Review" value={pendingReview.length} onClick={goTo("review")} />
        <StatCard
          icon={Gift}
          label="Active Tasks"
          value={tasks.filter((t) => t.status === TaskStatus.ASSIGNED || t.status === TaskStatus.OPEN).length}
          onClick={goTo("tasks")}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Review Queue</CardTitle>
          {pendingReview.length > 0 && (
            <Button variant="outline" size="sm" onClick={goTo("review")}>
              View all
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {pendingReview.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing pending review.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingReview.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">Review</Badge>
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.dueAt && <span className="text-muted-foreground shrink-0">{format(new Date(t.dueAt), "MMM d")}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
