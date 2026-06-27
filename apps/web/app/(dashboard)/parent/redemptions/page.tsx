"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Check, X, Carrot } from "@phosphor-icons/react"
import { RedemptionStatus } from "@workspace/types"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"

interface Redemption {
  id: string
  costAtRequest: number
  status: string
  createdAt: string
  decidedAt?: string
  childUser?: { displayName: string }
  rewardOption?: { title: string }
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  [RedemptionStatus.REQUESTED]: "default",
  [RedemptionStatus.APPROVED]: "secondary",
  [RedemptionStatus.REJECTED]: "destructive",
  [RedemptionStatus.CANCELLED]: "outline",
}

export default function ParentRedemptionsPage() {
  const { user } = useAuth()
  const familyId = user?.familyId
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    if (!familyId) return
    api
      .get<Redemption[]>(`/families/${familyId}/redemptions`)
      .then(setRedemptions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [familyId])

  async function approve(id: string) {
    if (!familyId) return
    try {
      await api.post(`/families/${familyId}/redemptions/${id}/approve`, {})
      toast.success("Redemption approved and carrots spent")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed — the child may not have enough carrots")
    }
  }

  async function reject(id: string) {
    if (!familyId) return
    try {
      await api.post(`/families/${familyId}/redemptions/${id}/reject`, {})
      toast.success("Redemption rejected")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  const pending = redemptions.filter((r) => r.status === RedemptionStatus.REQUESTED)
  const history = redemptions.filter((r) => r.status !== RedemptionStatus.REQUESTED)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Redemptions</h1>
        <p className="text-muted-foreground text-sm">Approve or reject children&apos;s reward requests.</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pending.length > 0 && <Badge className="ml-2 size-5 rounded-full p-0 text-xs">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">No pending redemptions.</TableCell>
                </TableRow>
              )}
              {pending.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.childUser?.displayName ?? "—"}</TableCell>
                  <TableCell>{r.rewardOption?.title ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Carrot className="size-3" />
                      {r.costAtRequest}
                    </span>
                  </TableCell>
                  <TableCell>{format(new Date(r.createdAt), "MMM d, h:mm a")}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => reject(r.id)}>
                        <X data-icon="inline-start" />
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => approve(r.id)}>
                        <Check data-icon="inline-start" />
                        Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">No history yet.</TableCell>
                </TableRow>
              )}
              {history.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.childUser?.displayName ?? "—"}</TableCell>
                  <TableCell>{r.rewardOption?.title ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Carrot className="size-3" />
                      {r.costAtRequest}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status] ?? "outline"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell>{r.decidedAt ? format(new Date(r.decidedAt), "MMM d") : format(new Date(r.createdAt), "MMM d")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  )
}
