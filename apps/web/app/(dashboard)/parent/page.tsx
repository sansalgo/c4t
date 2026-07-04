"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Users, Hourglass, Gift, Carrot, Plus } from "@phosphor-icons/react"
import { TaskStatus } from "@workspace/types"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"

interface Member { id: string; userId: string; role: string; user: { displayName: string; email?: string } }
interface Task { id: string; title: string; status: string; dueAt?: string; assignedToUser?: { displayName: string } }
interface Balance { balance: number }

function StatCard({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: number | string; href: string }) {
  return (
    <Link href={href}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardDescription>{label}</CardDescription>
          <Icon className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function ParentOverviewPage() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [childBalances, setChildBalances] = useState<Record<string, number>>({})
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
        const children = m.filter((mem) => mem.role === "CHILD")
        return Promise.all(
          children.map((c) =>
            api
              .get<Balance>(`/families/${familyId}/children/${c.userId}/balance`)
              .then((b) => ({ id: c.userId, balance: b.balance }))
              .catch(() => ({ id: c.userId, balance: 0 })),
          ),
        )
      })
      .then((balances) => {
        const map: Record<string, number> = {}
        balances.forEach(({ id, balance }) => { map[id] = balance })
        setChildBalances(map)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [familyId])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const children = members.filter((m) => m.role === "CHILD")
  const pendingReview = tasks.filter((t) => t.status === TaskStatus.PENDING_REVIEW)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Family Overview</h1>
        <p className="text-muted-foreground text-sm">Manage your family&apos;s tasks and rewards.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Children" value={children.length} href="/parent/tasks" />
        <StatCard icon={Hourglass} label="Pending Review" value={pendingReview.length} href="/parent/review" />
        <StatCard icon={Gift} label="Active Tasks" value={tasks.filter((t) => t.status === TaskStatus.ASSIGNED || t.status === TaskStatus.OPEN).length} href="/parent/tasks" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Children & Balances */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Children</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/parent/tasks">
                <Plus data-icon="inline-start" />
                Add task
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {children.length === 0 ? (
              <p className="text-muted-foreground text-sm">No children yet. Create a child account from the Tasks page.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/parent/children/${c.userId}`} className="flex items-center gap-3 rounded-md p-1 hover:bg-accent transition-colors">
                      <Avatar className="size-8">
                        <AvatarFallback>{(c.user.displayName[0] ?? "?").toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-sm">{c.user.displayName}</p>
                      </div>
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <Carrot className="size-3" weight="fill" />
                        {childBalances[c.userId] ?? 0}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent pending review */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Review Queue</CardTitle>
            {pendingReview.length > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/parent/review">View all</Link>
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
                    {t.dueAt && (
                      <span className="text-muted-foreground shrink-0">{format(new Date(t.dueAt), "MMM d")}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
