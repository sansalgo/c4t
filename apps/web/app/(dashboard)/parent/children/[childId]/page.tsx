"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import { Carrot, TrendUp, TrendDown } from "@phosphor-icons/react"
import { LedgerEntryType } from "@workspace/types"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Separator } from "@workspace/ui/components/separator"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@workspace/ui/components/field"
import { Progress } from "@workspace/ui/components/progress"

interface LedgerEntry {
  id: string; type: string; amount: number; note?: string; createdAt: string; sourceType?: string
}
interface UserProfile { id: string; displayName: string; email?: string }

const typeLabel: Record<string, string> = {
  [LedgerEntryType.EARN]: "Earned",
  [LedgerEntryType.SPEND]: "Spent",
  [LedgerEntryType.REVERSAL]: "Reversal",
  [LedgerEntryType.ADJUST]: "Adjustment",
}

export default function ChildLedgerPage() {
  const { user } = useAuth()
  const { childId } = useParams<{ childId: string }>()
  const familyId = user?.familyId

  const [childProfile, setChildProfile] = useState<UserProfile | null>(null)
  const [balance, setBalance] = useState(0)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustNote, setAdjustNote] = useState("")
  const [adjusting, setAdjusting] = useState(false)

  function load() {
    if (!familyId || !childId) return
    Promise.all([
      api.get<{ balance: number }>(`/families/${familyId}/children/${childId}/balance`),
      api.get<LedgerEntry[]>(`/families/${familyId}/children/${childId}/ledger`),
      api.get<{ members: Array<{ userId: string; user: UserProfile }> }>(`/families/${familyId}/members`).catch(() => null),
    ])
      .then(([b, ledger, membersRes]) => {
        setBalance(b.balance)
        setEntries(ledger)
        if (membersRes) {
          const member = (membersRes as any).find?.((m: any) => m.userId === childId)
          if (member) setChildProfile(member.user)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (familyId && childId) {
      api.get<any[]>(`/families/${familyId}/members`)
        .then((members) => {
          const member = members.find((m) => m.userId === childId)
          if (member) setChildProfile(member.user)
        })
        .catch(() => {})
    }
    load()
  }, [familyId, childId])

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!familyId || !childId) return
    const amount = parseInt(adjustAmount, 10)
    if (isNaN(amount) || amount === 0) { toast.error("Amount must be a non-zero number"); return }
    setAdjusting(true)
    try {
      await api.post(`/families/${familyId}/children/${childId}/adjustments`, { amount, note: adjustNote.trim() || undefined })
      toast.success(`${amount > 0 ? "Added" : "Removed"} ${Math.abs(amount)} carrots`)
      setAdjustAmount("")
      setAdjustNote("")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setAdjusting(false)
    }
  }

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  const earned = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const spent = entries.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="size-12">
          <AvatarFallback className="text-lg">{childProfile?.displayName?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{childProfile?.displayName ?? "Child"}</h1>
          {childProfile?.email && <p className="text-muted-foreground text-sm">{childProfile.email}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current balance</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Carrot className="text-primary size-5" />
            <span className="text-3xl font-bold">{balance}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total earned</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-green-600">
            <TrendUp className="size-5" />
            <span className="text-2xl font-bold">{earned}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total spent</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-red-500">
            <TrendDown className="size-5" />
            <span className="text-2xl font-bold">{spent}</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ledger */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ledger history</CardTitle>
            <CardDescription>All carrot transactions for this child.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center">No transactions yet.</TableCell>
                  </TableRow>
                )}
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant={entry.amount >= 0 ? "secondary" : "outline"}>{typeLabel[entry.type] ?? entry.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-50 truncate">{entry.note ?? "—"}</TableCell>
                    <TableCell className={`text-right font-mono font-medium ${entry.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {entry.amount >= 0 ? "+" : ""}{entry.amount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(entry.createdAt), "MMM d, yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Manual adjustment */}
        <Card>
          <CardHeader>
            <CardTitle>Manual adjustment</CardTitle>
            <CardDescription>Add or remove carrots. Use positive for rewards, negative for deductions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitAdjust}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="adj-amount">Amount</FieldLabel>
                  <Input
                    id="adj-amount"
                    type="number"
                    placeholder="+10 or -5"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                  />
                  <FieldDescription>Positive adds, negative removes.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="adj-note">Note</FieldLabel>
                  <Textarea
                    id="adj-note"
                    placeholder="Reason for adjustment"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    rows={2}
                  />
                </Field>
                <Button type="submit" disabled={adjusting} className="w-full">
                  {adjusting ? "Applying…" : "Apply adjustment"}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
