"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { PlusCircle, PencilSimple, Carrot } from "@phosphor-icons/react"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Switch } from "@workspace/ui/components/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"

interface Reward { id: string; title: string; description?: string; costCarrots: number; isActive: boolean }

interface RewardForm { title: string; description: string; costCarrots: string }
const emptyForm: RewardForm = { title: "", description: "", costCarrots: "10" }

export function RewardsWindowContent() {
  const { user } = useAuth()
  const familyId = user?.familyId
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Reward | null>(null)
  const [form, setForm] = useState<RewardForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    if (!familyId) return
    api.get<Reward[]>(`/families/${familyId}/rewards`)
      .then(setRewards)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [familyId])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(reward: Reward) {
    setEditing(reward)
    setForm({ title: reward.title, description: reward.description ?? "", costCarrots: String(reward.costCarrots) })
    setDialogOpen(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!familyId) return
    const body = { title: form.title.trim(), description: form.description.trim() || undefined, costCarrots: parseInt(form.costCarrots, 10) }
    setSubmitting(true)
    try {
      if (editing) {
        await api.patch(`/families/${familyId}/rewards/${editing.id}`, body)
        toast.success("Reward updated")
      } else {
        await api.post(`/families/${familyId}/rewards`, body)
        toast.success("Reward created")
      }
      setDialogOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(reward: Reward) {
    if (!familyId) return
    try {
      if (reward.isActive) {
        await api.delete(`/families/${familyId}/rewards/${reward.id}`)
      } else {
        await api.patch(`/families/${familyId}/rewards/${reward.id}`, { isActive: true })
      }
      setRewards((prev) => prev.map((r) => r.id === reward.id ? { ...r, isActive: !r.isActive } : r))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  if (loading) return <div className="flex flex-col gap-4"><div className="grid gap-4 sm:grid-cols-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div></div>
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  const active = rewards.filter((r) => r.isActive)
  const inactive = rewards.filter((r) => !r.isActive)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <PlusCircle data-icon="inline-start" />
          New reward
        </Button>
      </div>

      {rewards.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Carrot className="text-muted-foreground size-8" />
            <p className="font-medium">No rewards yet</p>
            <p className="text-muted-foreground text-sm">Create reward options for your children to redeem.</p>
            <Button className="mt-2" onClick={openCreate}><PlusCircle data-icon="inline-start" />New reward</Button>
          </CardContent>
        </Card>
      )}

      {active.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">Active</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((reward) => <RewardCard key={reward.id} reward={reward} onEdit={openEdit} onToggle={toggleActive} />)}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-muted-foreground font-semibold">Inactive</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {inactive.map((reward) => <RewardCard key={reward.id} reward={reward} onEdit={openEdit} onToggle={toggleActive} />)}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit reward" : "New reward"}</DialogTitle>
            <DialogDescription>Set a title and carrot cost for this reward.</DialogDescription>
          </DialogHeader>
          <form id="reward-form" onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="r-title">Title *</FieldLabel>
                <Input id="r-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="r-desc">Description</FieldLabel>
                <Textarea id="r-desc" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
              </Field>
              <Field>
                <FieldLabel htmlFor="r-cost">Cost in carrots *</FieldLabel>
                <Input id="r-cost" type="number" min={1} value={form.costCarrots} onChange={(e) => setForm((p) => ({ ...p, costCarrots: e.target.value }))} required />
              </Field>
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" form="reward-form" disabled={submitting}>{submitting ? "Saving…" : (editing ? "Save" : "Create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RewardCard({ reward, onEdit, onToggle }: { reward: Reward; onEdit: (r: Reward) => void; onToggle: (r: Reward) => void }) {
  return (
    <Card className={!reward.isActive ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{reward.title}</CardTitle>
          <Badge variant="secondary" className="gap-1 shrink-0">
            <Carrot className="size-3" />
            {reward.costCarrots}
          </Badge>
        </div>
        {reward.description && <CardDescription className="line-clamp-2">{reward.description}</CardDescription>}
      </CardHeader>
      <Separator />
      <CardFooter className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-2 text-sm">
          <Switch checked={reward.isActive} onCheckedChange={() => onToggle(reward)} />
          <span className="text-muted-foreground">{reward.isActive ? "Active" : "Inactive"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onEdit(reward)}>
          <PencilSimple className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
