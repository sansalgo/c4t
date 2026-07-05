"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Check, X, File, ArrowSquareOut } from "@phosphor-icons/react"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Textarea } from "@workspace/ui/components/textarea"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Separator } from "@workspace/ui/components/separator"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"

interface Attachment { id: string; contentType: string }
interface Task {
  id: string; title: string; description?: string; carrotValue: number
  dueAt?: string; requiresFileOnReview: boolean
  assignedToUser?: { displayName: string }
  attachments?: Attachment[]
}

export function ReviewWindowContent() {
  const { user } = useAuth()
  const familyId = user?.familyId
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null })
  const [rejectNote, setRejectNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})

  function load() {
    if (!familyId) return
    api
      .get<Task[]>(`/families/${familyId}/tasks?status=PENDING_REVIEW`)
      .then((all) => {
        const pending = all.filter((t: Task) => (t as any).status === "PENDING_REVIEW")
        setTasks(pending)
        pending.forEach((task) => {
          api
            .get<Attachment[]>(`/families/${familyId}/tasks/${task.id}/attachments`)
            .then((atts) => {
              if (atts.length > 0) {
                api
                  .get<{ url: string }>(`/families/${familyId}/tasks/${task.id}/attachments/${atts[0]!.id}/url`)
                  .then(({ url }) => setAttachmentUrls((prev) => ({ ...prev, [task.id]: url })))
                  .catch(() => {})
              }
            })
            .catch(() => {})
        })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [familyId])

  async function approve(task: Task) {
    if (!familyId) return
    try {
      await api.post(`/families/${familyId}/tasks/${task.id}/approve`, {})
      toast.success(`Approved! ${task.carrotValue} carrots earned by ${task.assignedToUser?.displayName}`)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve")
    }
  }

  function openReject(task: Task) {
    setRejectDialog({ open: true, task })
    setRejectNote("")
  }

  async function submitReject() {
    if (!familyId || !rejectDialog.task) return
    setSubmitting(true)
    try {
      await api.post(`/families/${familyId}/tasks/${rejectDialog.task.id}/reject`, { note: rejectNote })
      toast.success("Task sent back to assigned")
      setTasks((prev) => prev.filter((t) => t.id !== rejectDialog.task!.id))
      setRejectDialog({ open: false, task: null })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-40 rounded-xl" /></div>
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  return (
    <div className="flex flex-col gap-6">
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Check className="text-muted-foreground size-8" />
            <p className="font-medium">All caught up!</p>
            <p className="text-muted-foreground text-sm">No tasks are waiting for review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{task.title}</CardTitle>
                    <CardDescription>
                      Submitted by {task.assignedToUser?.displayName ?? "unknown"}
                      {task.dueAt && ` · Due ${format(new Date(task.dueAt), "MMM d")}`}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{task.carrotValue} 🥕</Badge>
                </div>
              </CardHeader>
              {(task.description || attachmentUrls[task.id]) && (
                <>
                  <Separator />
                  <CardContent className="flex flex-col gap-3 pt-4">
                    {task.description && <p className="text-sm">{task.description}</p>}
                    {attachmentUrls[task.id] && (
                      <a
                        href={attachmentUrls[task.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                      >
                        <File className="size-4" />
                        View proof file
                        <ArrowSquareOut className="size-3" />
                      </a>
                    )}
                  </CardContent>
                </>
              )}
              <Separator />
              <CardContent className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => openReject(task)}>
                  <X data-icon="inline-start" />
                  Reject
                </Button>
                <Button onClick={() => approve(task)}>
                  <Check data-icon="inline-start" />
                  Approve & award carrots
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog((p) => ({ ...p, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject task</DialogTitle>
            <DialogDescription>
              Send &ldquo;{rejectDialog.task?.title}&rdquo; back to {rejectDialog.task?.assignedToUser?.displayName}. Add a note so they know what to fix.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="note">Reason (optional)</FieldLabel>
              <Textarea
                id="note"
                placeholder="e.g. Please take a clearer photo"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, task: null })}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject} disabled={submitting}>
              {submitting ? "Rejecting…" : "Reject task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
