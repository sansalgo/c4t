"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CheckSquare,
  ClipboardText,
  Gift,
  House,
  SignOut,
  ShoppingCart,
  Carrot,
  Wallet,
  Eye,
} from "@phosphor-icons/react"
import { MemberRole } from "@workspace/types"
import { useAuth } from "@/components/auth-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

const parentNav = [
  { label: "Overview", href: "/parent", icon: House },
  { label: "Tasks", href: "/parent/tasks", icon: CheckSquare },
  { label: "Review Queue", href: "/parent/review", icon: Eye },
  { label: "Rewards", href: "/parent/rewards", icon: Gift },
  { label: "Redemptions", href: "/parent/redemptions", icon: ShoppingCart },
]

const childNav = [
  { label: "My Tasks", href: "/child", icon: ClipboardText },
  { label: "Balance & History", href: "/child/balance", icon: Wallet },
  { label: "Rewards", href: "/child/rewards", icon: Gift },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login")
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Skeleton className="size-8 rounded-full" />
      </div>
    )
  }

  if (!user) return null

  const isParent = user.role === MemberRole.PARENT
  const navItems = isParent ? parentNav : childNav
  const roleName = isParent ? "Parent" : "Child"

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <Carrot className="text-primary size-5" weight="fill" />
            <span className="font-semibold">c4t</span>
            <span className="text-muted-foreground ml-auto text-xs">{roleName}</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ label, href, icon: Icon }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={pathname === href || (href !== "/parent" && href !== "/child" && pathname.startsWith(href))}>
                      <Link href={href}>
                        <Icon />
                        {label}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout} className="text-muted-foreground hover:text-foreground">
                <SignOut />
                Sign out
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
