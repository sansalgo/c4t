"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Carrot, Gift, Clock, Check, X } from "@phosphor-icons/react"
import { RedemptionStatus } from "@workspace/types"
import { api } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@workspace/ui/components/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Separator } from "@workspace/ui/components/separator"
import { Progress } from "@workspace/ui/components/progress"

interface Reward { id: string; title: string; description?: string; costCarrots: number; isActive: boolean }
interface Redemption {
  id: string; status: string; costAtRequest: number; createdAt: string; decidedAt?: string
  rewardOption?: { title: string }
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  [RedemptionStatus.REQUESTED]: "default",
  [RedemptionStatus.APPROVED]: "secondary",
  [RedemptionStatus.REJECTED]: "destructive",
  [RedemptionStatus.CANCELLED]: "outline",
}
const statusLabel: Record<string, string> = {
  [RedemptionStatus.REQUESTED]: "Pending",
  [RedemptionStatus.APPROVED]: "Approved",
  [RedemptionStatus.REJECTED]: "Rejected",
  [RedemptionStatus.CANCELLED]: "Cancelled",
}

export default function ChildRewardsPage() {
  const { user } = useAuth()
  const familyId = user?.familyId
  const userId = user?.userId
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState<string | null>(null)

  function load() {
    if (!familyId || !userId) return
    Promise.all([
      api.get<Reward[]>(`/families/${familyId}/rewards`),
      api.get<Redemption[]>(`/families/${familyId}/redemptions`),
      api.get<{ balance: number }>(`/families/${familyId}/children/${userId}/balance`),
    ])
      .then(([r, redemps, b]) => {
        setRewards(r.filter((rw) => rw.isActive))
        setRedemptions(redemps)
        setBalance(b.balance)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [familyId, userId])

  async function requestRedemption(rewardId: string) {
    if (!familyId) return
    setRequesting(rewardId)
    try {
      await api.post(`/families/${familyId}/redemptions`, { rewardOptionId: rewardId })
      toast.success("Redemption requested! Waiting for parent approval.")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setRequesting(null)
    }
  }

  async function cancelRedemption(redemptionId: string) {
    if (!familyId) return
    try {
      await api.delete(`/families/${familyId}/redemptions/${redemptionId}`)
      toast.success("Request cancelled")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  if (loading) return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
    </div>
  )
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  const pendingRequests = redemptions.filter((r) => r.status === RedemptionStatus.REQUESTED)
  const requestedIds = new Set(pendingRequests.map((r) => r.rewardOption?.title))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rewards</h1>
          <p className="text-muted-foreground text-sm">Spend your carrots on rewards.</p>
        </div>
        <Badge variant="secondary" className="gap-1.5 text-base px-3 py-1">
          <Carrot className="size-4" />
          {balance} carrots
        </Badge>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="requests">
            My Requests
            {pendingRequests.length > 0 && (
              <Badge className="ml-2 size-5 rounded-full p-0 text-xs">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          {rewards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Gift className="text-muted-foreground size-8" />
                <p className="font-medium">No rewards available</p>
                <p className="text-muted-foreground text-sm">Ask a parent to add some!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rewards.map((reward) => {
                const canAfford = balance >= reward.costCarrots
                const alreadyPending = requestedIds.has(reward.title)
                const progress = Math.min(100, Math.round((balance / reward.costCarrots) * 100))

                return (
                  <Card key={reward.id} className={!canAfford ? "opacity-75" : ""}>
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
                    {!canAfford && (
                      <CardContent className="pb-2">
                        <div className="flex flex-col gap-1">
                          <div className="text-muted-foreground flex justify-between text-xs">
                            <span>Your balance</span>
                            <span>{balance}/{reward.costCarrots}</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      </CardContent>
                    )}
                    <Separator />
                    <CardFooter className="pt-4">
                      {alreadyPending ? (
                        <Button variant="outline" className="w-full" disabled>
                          <Clock data-icon="inline-start" />
                          Request pending
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              className="w-full"
                              variant={canAfford ? "default" : "outline"}
                              disabled={!canAfford || requesting === reward.id}
                            >
                              {requesting === reward.id ? "Requesting…" : (
                                canAfford ? "Request this reward" : `Need ${reward.costCarrots - balance} more carrots`
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Request &ldquo;{reward.title}&rdquo;?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will spend {reward.costCarrots} carrots (your balance: {balance}) once a parent approves.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => requestRedemption(reward.id)}>Request</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {redemptions.length === 0 ? (
            <Card><CardContent className="text-muted-foreground py-10 text-center text-sm">No requests yet.</CardContent></Card>
          ) : (
            <div className="flex flex-col gap-3">
              {redemptions.map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{r.rewardOption?.title ?? "Unknown reward"}</p>
                      <p className="text-muted-foreground text-sm">{format(new Date(r.createdAt), "MMM d, yyyy")}</p>
                    </div>
                    <Badge variant="secondary" className="gap-1 shrink-0">
                      <Carrot className="size-3" />
                      {r.costAtRequest}
                    </Badge>
                    <Badge variant={statusVariant[r.status] ?? "outline"}>{statusLabel[r.status] ?? r.status}</Badge>
                    {r.status === RedemptionStatus.REQUESTED && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0">
                            <X className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel request?</AlertDialogTitle>
                            <AlertDialogDescription>Your carrots won&apos;t be spent and this request will be cancelled.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelRedemption(r.id)}>Cancel request</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
