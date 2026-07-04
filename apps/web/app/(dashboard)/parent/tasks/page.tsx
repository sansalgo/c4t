"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Carrot, PlusCircle, PencilSimple, Trash } from "@phosphor-icons/react"
import { TaskStatus } from "@workspace/types"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@workspace/ui/components/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"

interface Member { id: string; userId: string; role: string; user: { displayName: string } }
interface Task {
  id: string; title: string; description?: string; status: string
  assignedToUserId: string | null; dueAt?: string; carrotValue: number
  requiresReview: boolean; requiresFileOnReview: boolean
  assignedToUser?: { displayName: string }
}

const OPEN_VALUE = "__open__"

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  [TaskStatus.OPEN]: "outline",
  [TaskStatus.ASSIGNED]: "secondary",
  [TaskStatus.PENDING_REVIEW]: "default",
  [TaskStatus.COMPLETED]: "outline",
}

const statusLabel: Record<string, string> = {
  [TaskStatus.OPEN]: "Open to anyone",
  [TaskStatus.ASSIGNED]: "Assigned",
  [TaskStatus.PENDING_REVIEW]: "Pending Review",
  [TaskStatus.COMPLETED]: "Completed",
}

interface TaskForm {
  title: string; description: string; assignedToUserId: string
  dueAt: string; carrotValue: string; requiresReview: boolean; requiresFileOnReview: boolean
}

const emptyForm: TaskForm = {
  title: "", description: "", assignedToUserId: OPEN_VALUE, dueAt: "", carrotValue: "1", requiresReview: false, requiresFileOnReview: false,
}

export default function ParentTasksPage() {
  const { user } = useAuth()
  const familyId = user?.familyId
  const [tasks, setTasks] = useState<Task[]>([])
  const [children, setChildren] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [createChildOpen, setCreateChildOpen] = useState(false)
  const [childForm, setChildForm] = useState({ displayName: "", email: "" })
  const [childSubmitting, setChildSubmitting] = useState(false)

  function load() {
    if (!familyId) return
    return Promise.all([
      api.get<Task[]>(`/families/${familyId}/tasks`),
      api.get<Member[]>(`/families/${familyId}/members`),
    ])
      .then(([t, m]) => {
        setTasks(t)
        setChildren(m.filter((mem) => mem.role === "CHILD"))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [familyId])

  function openCreate() {
    setEditingTask(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setForm({
      title: task.title, description: task.description ?? "", assignedToUserId: task.assignedToUserId ?? OPEN_VALUE,
      dueAt: task.dueAt ? task.dueAt.substring(0, 10) : "", carrotValue: String(task.carrotValue),
      requiresReview: task.requiresReview, requiresFileOnReview: task.requiresFileOnReview,
    })
    setDialogOpen(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!familyId) return
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      assignedToUserId: form.assignedToUserId === OPEN_VALUE ? undefined : form.assignedToUserId,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      carrotValue: parseInt(form.carrotValue, 10),
      requiresReview: form.requiresReview,
      requiresFileOnReview: form.requiresFileOnReview,
    }
    setSubmitting(true)
    try {
      if (editingTask) {
        await api.patch(`/families/${familyId}/tasks/${editingTask.id}`, body)
        toast.success("Task updated")
      } else {
        await api.post(`/families/${familyId}/tasks`, body)
        toast.success("Task created")
      }
      setDialogOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete(taskId: string) {
    if (!familyId) return
    try {
      await api.delete(`/families/${familyId}/tasks/${taskId}`)
      toast.success("Task deleted")
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  async function onCreateChild(e: React.FormEvent) {
    e.preventDefault()
    if (!familyId) return
    setChildSubmitting(true)
    try {
      const res = await api.post<{ token: string }>(`/auth/families/${familyId}/children`, {
        displayName: childForm.displayName.trim(),
        email: childForm.email.trim() || undefined,
      })
      toast.success(`Child created! Invite token: ${res.token}`, { duration: 10000 })
      setCreateChildOpen(false)
      setChildForm({ displayName: "", email: "" })
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setChildSubmitting(false)
    }
  }

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateChildOpen(true)}>
            <PlusCircle data-icon="inline-start" />
            Add child
          </Button>
          <Button onClick={openCreate} disabled={children.length === 0}>
            <PlusCircle data-icon="inline-start" />
            New task
          </Button>
        </div>
      </div>

      {children.length === 0 && (
        <Alert>
          <AlertDescription>Add a child account first before creating tasks.</AlertDescription>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Carrots</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground text-center">No tasks yet.</TableCell>
            </TableRow>
          )}
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>{task.assignedToUser?.displayName ?? (task.status === TaskStatus.OPEN ? "Open to anyone" : "—")}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[task.status] ?? "outline"}>{statusLabel[task.status] ?? task.status}</Badge>
              </TableCell>
              <TableCell>{task.dueAt ? format(new Date(task.dueAt), "MMM d") : "—"}</TableCell>
              <TableCell className="text-right">
                <span className="flex items-center justify-end gap-1">
                  <Carrot className="size-3" />
                  {task.carrotValue}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(task)}>
                    <PencilSimple className="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete task?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove &ldquo;{task.title}&rdquo;.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(task.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Create/Edit task dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>Assign a task to a child, or leave it open for any child to claim.</DialogDescription>
          </DialogHeader>
          <form id="task-form" onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Title *</FieldLabel>
                <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="desc">Description</FieldLabel>
                <Textarea id="desc" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
              </Field>
              <Field>
                <FieldLabel htmlFor="child">Assigned to</FieldLabel>
                <Select value={form.assignedToUserId} onValueChange={(v) => setForm((p) => ({ ...p, assignedToUserId: v }))}>
                  <SelectTrigger id="child">
                    <SelectValue placeholder="Select a child" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OPEN_VALUE}>Open to anyone (first to claim)</SelectItem>
                    {children.map((c) => (
                      <SelectItem key={c.userId} value={c.userId}>{c.user.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="dueAt">Due date</FieldLabel>
                  <Input id="dueAt" type="date" value={form.dueAt} onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="carrots">Carrots *</FieldLabel>
                  <Input id="carrots" type="number" min={1} value={form.carrotValue} onChange={(e) => setForm((p) => ({ ...p, carrotValue: e.target.value }))} required />
                </Field>
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.requiresReview}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, requiresReview: !!v, requiresFileOnReview: !!v ? p.requiresFileOnReview : false }))}
                  />
                  Requires parent review before earning carrots
                </label>
                <label className={`flex items-center gap-2 text-sm cursor-pointer ${!form.requiresReview ? "opacity-50 pointer-events-none" : ""}`}>
                  <Checkbox
                    checked={form.requiresFileOnReview}
                    disabled={!form.requiresReview}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, requiresFileOnReview: !!v }))}
                  />
                  Requires a photo/file as proof
                </label>
              </div>
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" form="task-form" disabled={submitting}>
              {submitting ? "Saving…" : (editingTask ? "Save changes" : "Create task")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create child dialog */}
      <Dialog open={createChildOpen} onOpenChange={setCreateChildOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a child</DialogTitle>
            <DialogDescription>Creates a child account and generates an invite link for them to claim.</DialogDescription>
          </DialogHeader>
          <form id="child-form" onSubmit={onCreateChild}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="childName">Child&apos;s name *</FieldLabel>
                <Input id="childName" value={childForm.displayName} onChange={(e) => setChildForm((p) => ({ ...p, displayName: e.target.value }))} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="childEmail">Email (optional)</FieldLabel>
                <Input id="childEmail" type="email" value={childForm.email} onChange={(e) => setChildForm((p) => ({ ...p, email: e.target.value }))} />
              </Field>
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateChildOpen(false)}>Cancel</Button>
            <Button type="submit" form="child-form" disabled={childSubmitting}>
              {childSubmitting ? "Creating…" : "Create child"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
