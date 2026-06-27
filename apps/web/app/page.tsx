"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { MemberRole } from "@workspace/types"
import { useAuth } from "@/components/auth-provider"
import { Skeleton } from "@workspace/ui/components/skeleton"

export default function RootPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/login")
    } else if (user.role === MemberRole.PARENT) {
      router.replace("/parent")
    } else {
      router.replace("/child")
    }
  }, [user, isLoading, router])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Skeleton className="size-8 rounded-full" />
    </div>
  )
}
