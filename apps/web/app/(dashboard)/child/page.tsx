"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Carrot, Upload, CheckCircle, Clock, Circle, Megaphone } from "@phosphor-icons/react"
import { TaskStatus } from "@workspace/types"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Separator } from "@workspace/ui/components/separator"
import { Progress } from "@workspace/ui/components/progress"

interface Task {
  id: string; title: string; description?: string; status: string
  carrotValue: number; dueAt?: string; requiresReview: boolean
  requiresFileOnReview: boolean; rejectionNote?: string
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]

function statusIcon(status: string) {
  if (status === TaskStatus.COMPLETED) return <CheckCircle className="size-4 text-green-500" />
  if (status === TaskStatus.PENDING_REVIEW) return <Clock className="size-4 text-yellow-500" />
  if (status === TaskStatus.OPEN) return <Megaphone className="size-4 text-blue-500" />
  return <Circle className="size-4 text-muted-foreground" />
}

export default function ChildTasksPage() {
  const { user } = useAuth()
  const familyId = user?.familyId
  const userId = user?.userId
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [claiming, setClaiming] = useState<Record<string, boolean>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function load() {
    if (!familyId) return
    api.get<Task[]>(`/families/${familyId}/tasks`)
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [familyId])

  async function claimTask(task: Task) {
    if (!familyId) return
    setClaiming((p) => ({ ...p, [task.id]: true }))
    try {
      await api.post(`/families/${familyId}/tasks/${task.id}/claim`, {})
      toast.success("Task claimed — it's yours now!")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Someone else may have claimed it first")
      load()
    } finally {
      setClaiming((p) => ({ ...p, [task.id]: false }))
    }
  }

  async function markDone(task: Task) {
    if (!familyId) return
    if (task.requiresFileOnReview) {
      fileRefs.current[task.id]?.click()
      return
    }
    setSubmitting((p) => ({ ...p, [task.id]: true }))
    try {
      await api.post(`/families/${familyId}/tasks/${task.id}/submit`, {})
      toast.success(task.requiresReview ? "Submitted for review!" : "Task completed — carrots earned! 🥕")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setSubmitting((p) => ({ ...p, [task.id]: false }))
    }
  }

  async function handleFileUpload(task: Task, file: File) {
    if (!familyId) return
    if (!ACCEPTED_TYPES.includes(file.type)) { toast.error("File type not allowed"); return }
    if (file.size > 50 * 1024 * 1024) { toast.error("File too large (max 50 MB)"); return }

    setUploading((p) => ({ ...p, [task.id]: true }))
    try {
      // Step 1: get presigned URL
      const { uploadUrl, s3Key } = await api.post<{ uploadUrl: string; s3Key: string }>(
        `/families/${familyId}/tasks/${task.id}/attachments/presign`,
        { contentType: file.type, sizeBytes: file.size },
      )
      // Step 2: PUT to S3
      await api.putFile(uploadUrl, file)
      // Step 3: confirm with API
      await api.post(`/families/${familyId}/tasks/${task.id}/attachments`, {
        s3Key, contentType: file.type, sizeBytes: file.size,
      })
      toast.success("File uploaded — submitting task…")
      // Step 4: submit task
      await api.post(`/families/${familyId}/tasks/${task.id}/submit`, {})
      toast.success("Submitted for review!")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading((p) => ({ ...p, [task.id]: false }))
    }
  }

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" />{[0,1,2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  const open = tasks.filter((t) => t.status === TaskStatus.OPEN)
  const assigned = tasks.filter((t) => t.status === TaskStatus.ASSIGNED)
  const pendingReview = tasks.filter((t) => t.status === TaskStatus.PENDING_REVIEW)
  const completed = tasks.filter((t) => t.status === TaskStatus.COMPLETED)

  function TaskCard({ task }: { task: Task }) {
    const isUploading = uploading[task.id]
    const isSubmitting = submitting[task.id]
    const isClaiming = claiming[task.id]
    const busy = isUploading || isSubmitting || isClaiming

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {statusIcon(task.status)}
              <CardTitle className="text-base">{task.title}</CardTitle>
            </div>
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Carrot className="size-3" />
              {task.carrotValue}
            </Badge>
          </div>
          {task.dueAt && (
            <CardDescription>Due {format(new Date(task.dueAt), "MMM d, yyyy")}</CardDescription>
          )}
        </CardHeader>
        {task.description && (
          <CardContent className="pb-2">
            <p className="text-muted-foreground text-sm">{task.description}</p>
          </CardContent>
        )}
        {task.rejectionNote && (
          <CardContent className="pb-2">
            <Alert variant="destructive">
              <AlertTitle className="text-sm">Sent back</AlertTitle>
              <AlertDescription className="text-sm">{task.rejectionNote}</AlertDescription>
            </Alert>
          </CardContent>
        )}
        {task.status === TaskStatus.OPEN && (
          <>
            <Separator />
            <CardFooter className="pt-4">
              <Button className="w-full" onClick={() => claimTask(task)} disabled={busy}>
                {isClaiming ? "Claiming…" : "Claim task"}
              </Button>
            </CardFooter>
          </>
        )}
        {task.status === TaskStatus.ASSIGNED && (
          <>
            <Separator />
            <CardFooter className="pt-4">
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="sr-only"
                ref={(el) => { fileRefs.current[task.id] = el }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(task, f) }}
              />
              <Button className="w-full" onClick={() => markDone(task)} disabled={busy}>
                {isUploading ? (
                  <><Upload data-icon="inline-start" className="animate-bounce" />Uploading…</>
                ) : isSubmitting ? "Submitting…" : (
                  task.requiresFileOnReview ? (
                    <><Upload data-icon="inline-start" />Upload proof & submit</>
                  ) : "Mark as done"
                )}
              </Button>
            </CardFooter>
          </>
        )}
        {task.status === TaskStatus.PENDING_REVIEW && (
          <>
            <Separator />
            <CardFooter className="pt-4">
              <p className="text-muted-foreground text-sm">Waiting for parent review…</p>
            </CardFooter>
          </>
        )}
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <p className="text-muted-foreground text-sm">Complete tasks to earn carrots.</p>
      </div>

      <Tabs defaultValue="assigned">
        <TabsList>
          <TabsTrigger value="open">
            Up for grabs
            {open.length > 0 && <Badge className="ml-2 size-5 rounded-full p-0 text-xs">{open.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="assigned">
            To Do
            {assigned.length > 0 && <Badge className="ml-2 size-5 rounded-full p-0 text-xs">{assigned.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="review">
            In Review
            {pendingReview.length > 0 && <Badge className="ml-2 size-5 rounded-full p-0 text-xs">{pendingReview.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          {open.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Megaphone className="text-muted-foreground size-8" />
                <p className="font-medium">Nothing up for grabs</p>
                <p className="text-muted-foreground text-sm">Open tasks anyone can claim will show up here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {open.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assigned" className="mt-4">
          {assigned.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle className="text-muted-foreground size-8" />
                <p className="font-medium">All done!</p>
                <p className="text-muted-foreground text-sm">No tasks to complete right now.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {assigned.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          {pendingReview.length === 0 ? (
            <Card><CardContent className="text-muted-foreground py-10 text-center text-sm">Nothing awaiting review.</CardContent></Card>
          ) : (
            <div className="flex flex-col gap-4">{pendingReview.map((t) => <TaskCard key={t.id} task={t} />)}</div>
          )}
        </TabsContent>

        <TabsContent value="done" className="mt-4">
          {completed.length === 0 ? (
            <Card><CardContent className="text-muted-foreground py-10 text-center text-sm">Complete your first task to see it here!</CardContent></Card>
          ) : (
            <div className="flex flex-col gap-4">{completed.map((t) => <TaskCard key={t.id} task={t} />)}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
