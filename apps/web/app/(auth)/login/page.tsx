"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MemberRole } from "@workspace/types"
import { api, ApiError } from "@/lib/api"
import { parseToken } from "@/lib/auth"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!email) next.email = "Email is required"
    if (!password) next.password = "Password is required"
    if (Object.keys(next).length) { setErrors(next); return }

    setPending(true)
    setErrors({})
    try {
      const { access_token } = await api.post<{ access_token: string }>("/auth/login", { email, password })
      const authUser = parseToken(access_token)
      if (authUser) login(authUser)
      router.replace(authUser?.role === MemberRole.PARENT ? "/parent" : "/child")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrors({ general: "Invalid email or password" })
      } else {
        toast.error(err instanceof Error ? err.message : "Login failed")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to c4t</CardTitle>
          <CardDescription>Enter your email and password to continue.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FieldError>{errors.email}</FieldError>
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FieldError>{errors.password}</FieldError>
              </Field>
              {errors.general && (
                <p className="text-sm text-destructive">{errors.general}</p>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-muted-foreground text-sm">
              No account?{" "}
              <Link href="/signup" className="text-foreground underline underline-offset-4">
                Create one
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
