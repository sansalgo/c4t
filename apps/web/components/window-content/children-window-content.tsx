"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Carrot, PlusCircle } from "@phosphor-icons/react"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"

interface Member { id: string; userId: string; role: string; user: { displayName: string } }
interface Balance { balance: number }

export function ChildrenWindowContent() {
  const { user } = useAuth()
  const familyId = user?.familyId
  const [members, setMembers] = useState<Member[]>([])
  const [childBalances, setChildBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [createChildOpen, setCreateChildOpen] = useState(false)
  const [childForm, setChildForm] = useState({ displayName: "", email: "" })
  const [submitting, setSubmitting] = useState(false)

  function load() {
    if (!familyId) return
    api
      .get<Member[]>(`/families/${familyId}/members`)
      .then((m) => {
        setMembers(m)
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
        balances.forEach(({ id, balance }) => {
          map[id] = balance
        })
        setChildBalances(map)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [familyId])

  async function onCreateChild(e: React.FormEvent) {
    e.preventDefault()
    if (!familyId) return
    setSubmitting(true)
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
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    )
  }

  const children = members.filter((m) => m.role === "CHILD")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCreateChildOpen(true)}>
          <PlusCircle data-icon="inline-start" />
          Add child
        </Button>
      </div>

      {children.length === 0 ? (
        <p className="text-muted-foreground text-sm">No children yet. Add one to get started.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {children.map((c) => (
            <li key={c.id}>
              <Link
                href={`/parent/children/${c.userId}`}
                className="hover:bg-accent flex items-center gap-3 rounded-md p-1 transition-colors"
              >
                <Avatar className="size-8">
                  <AvatarFallback>{(c.user.displayName[0] ?? "?").toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.user.displayName}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 gap-1">
                  <Carrot className="size-3" weight="fill" />
                  {childBalances[c.userId] ?? 0}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

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
                <Input
                  id="childName"
                  value={childForm.displayName}
                  onChange={(e) => setChildForm((p) => ({ ...p, displayName: e.target.value }))}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="childEmail">Email (optional)</FieldLabel>
                <Input
                  id="childEmail"
                  type="email"
                  value={childForm.email}
                  onChange={(e) => setChildForm((p) => ({ ...p, email: e.target.value }))}
                />
              </Field>
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateChildOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="child-form" disabled={submitting}>
              {submitting ? "Creating…" : "Create child"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
