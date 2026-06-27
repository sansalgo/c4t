"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Carrot, TrendUp, TrendDown } from "@phosphor-icons/react"
import { LedgerEntryType } from "@workspace/types"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Progress } from "@workspace/ui/components/progress"

interface LedgerEntry {
  id: string; type: string; amount: number; note?: string; createdAt: string; sourceType?: string
}

const typeLabel: Record<string, string> = {
  [LedgerEntryType.EARN]: "Earned",
  [LedgerEntryType.SPEND]: "Spent",
  [LedgerEntryType.REVERSAL]: "Reversal",
  [LedgerEntryType.ADJUST]: "Adjustment",
}

const typeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  [LedgerEntryType.EARN]: "secondary",
  [LedgerEntryType.SPEND]: "outline",
  [LedgerEntryType.REVERSAL]: "destructive",
  [LedgerEntryType.ADJUST]: "default",
}

export default function ChildBalancePage() {
  const { user } = useAuth()
  const familyId = user?.familyId
  const userId = user?.userId
  const [balance, setBalance] = useState(0)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!familyId || !userId) return
    Promise.all([
      api.get<{ balance: number }>(`/families/${familyId}/children/${userId}/balance`),
      api.get<LedgerEntry[]>(`/families/${familyId}/children/${userId}/ledger`),
    ])
      .then(([b, ledger]) => {
        setBalance(b.balance)
        setEntries(ledger)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [familyId, userId])

  if (loading) return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  const earned = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const spent = entries.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0)
  const spendPercent = earned > 0 ? Math.round((spent / earned) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Balance & History</h1>
        <p className="text-muted-foreground text-sm">Your carrot balance and all transactions.</p>
      </div>

      {/* Balance card */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Current balance</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Carrot className="text-primary size-8" />
            <span className="text-5xl font-bold">{balance}</span>
            <span className="text-muted-foreground text-lg">carrots</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span className="flex items-center gap-1"><TrendUp className="size-3" />Earned: {earned}</span>
              <span className="flex items-center gap-1"><TrendDown className="size-3" />Spent: {spent}</span>
            </div>
            <Progress value={spendPercent} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total earned</CardDescription></CardHeader>
          <CardContent className="text-green-600 flex items-center gap-2">
            <TrendUp className="size-4" />
            <span className="text-xl font-bold">{earned}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total spent</CardDescription></CardHeader>
          <CardContent className="text-red-500 flex items-center gap-2">
            <TrendDown className="size-4" />
            <span className="text-xl font-bold">{spent}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Transactions</CardDescription></CardHeader>
          <CardContent>
            <span className="text-xl font-bold">{entries.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Ledger table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>Every carrot you&apos;ve earned, spent, or received.</CardDescription>
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
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No transactions yet. Complete a task to earn your first carrots!
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Badge variant={typeVariant[entry.type] ?? "outline"}>{typeLabel[entry.type] ?? entry.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-50 truncate">{entry.note ?? "—"}</TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${entry.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {entry.amount >= 0 ? "+" : ""}{entry.amount}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{format(new Date(entry.createdAt), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
