"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CaretUpDown,
  CheckSquare,
  ClipboardText,
  Gift,
  House,
  SignOut,
  ShoppingCart,
  Carrot,
  Wallet,
  Eye,
  Users,
} from "@phosphor-icons/react"
import { MemberRole } from "@workspace/types"
import { useAuth } from "@/components/auth-provider"
import { WindowManagerProvider, useWindowManager, type WindowId } from "@/components/window-manager-provider"
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
} from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

const parentNav: Array<{ label: string; windowId: WindowId; icon: React.ElementType }> = [
  { label: "Overview", windowId: "overview", icon: House },
  { label: "Children", windowId: "children", icon: Users },
  { label: "Tasks", windowId: "tasks", icon: CheckSquare },
  { label: "Review Queue", windowId: "review", icon: Eye },
  { label: "Rewards", windowId: "rewards", icon: Gift },
  { label: "Redemptions", windowId: "redemptions", icon: ShoppingCart },
]

const childNav = [
  { label: "My Tasks", href: "/child", icon: ClipboardText },
  { label: "Balance & History", href: "/child/balance", icon: Wallet },
  { label: "Rewards", href: "/child/rewards", icon: Gift },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()

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
  const roleName = isParent ? "Parent" : "Child"

  return (
    <WindowManagerProvider>
      <DashboardChrome isParent={isParent} roleName={roleName} logout={logout}>
        {children}
      </DashboardChrome>
    </WindowManagerProvider>
  )
}

function DashboardChrome({
  isParent,
  roleName,
  logout,
  children,
}: {
  isParent: boolean
  roleName: string
  logout: () => Promise<void>
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user } = useAuth()
  const { windows, openWindow, restoreWindow, focusWindow } = useWindowManager()
  const displayName = user?.displayName ?? "Account"
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
      <SidebarProvider className="h-svh min-h-0 w-full gap-3 p-3">
        <Sidebar collapsible="none" className="w-(--sidebar-width) shrink-0 overflow-hidden rounded-xl border bg-sidebar shadow-sm">
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
                  {isParent
                    ? parentNav.map(({ label, windowId, icon: Icon }) => {
                        const state = windows[windowId]
                        return (
                          <SidebarMenuItem key={windowId}>
                            <SidebarMenuButton
                              isActive={state.open && !state.minimized}
                              onClick={() => {
                                if (!state.open) openWindow(windowId)
                                else if (state.minimized) restoreWindow(windowId)
                                else focusWindow(windowId)
                              }}
                            >
                              <Icon />
                              {label}
                              {state.minimized && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary" />}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })
                    : childNav.map(({ label, href, icon: Icon }) => (
                        <SidebarMenuItem key={href}>
                          <SidebarMenuButton asChild isActive={pathname === href || (href !== "/child" && pathname.startsWith(href))}>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg">
                      <Avatar className="size-8">
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                        <span className="truncate font-medium">{displayName}</span>
                        {user?.email && <span className="text-muted-foreground truncate text-xs">{user.email}</span>}
                      </div>
                      <CaretUpDown className="text-muted-foreground ml-auto size-4 shrink-0" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                    <DropdownMenuItem onClick={logout}>
                      <SignOut />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
  )
}
