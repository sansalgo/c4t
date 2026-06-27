"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api"
import { parseToken } from "@/lib/auth"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"

interface FormErrors {
  displayName?: string
  email?: string
  password?: string
  familyName?: string
}

export default function SignupPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [form, setForm] = useState({ displayName: "", email: "", password: "", familyName: "" })
  const [errors, setErrors] = useState<FormErrors>({})
  const [pending, setPending] = useState(false)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: FormErrors = {}
    if (!form.displayName.trim()) next.displayName = "Name is required"
    if (!form.email.trim()) next.email = "Email is required"
    if (form.password.length < 8) next.password = "Password must be at least 8 characters"
    if (!form.familyName.trim()) next.familyName = "Family name is required"
    if (Object.keys(next).length) { setErrors(next); return }

    setPending(true)
    setErrors({})
    try {
      const { access_token } = await api.post<{ access_token: string }>("/auth/signup", form)
      const authUser = parseToken(access_token)
      if (authUser) login(authUser)
      router.replace("/parent")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: "Email already in use" })
      } else {
        toast.error(err instanceof Error ? err.message : "Signup failed")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create a parent account</CardTitle>
          <CardDescription>Set up your family&apos;s c4t workspace.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.displayName}>
                <FieldLabel htmlFor="displayName">Your name</FieldLabel>
                <Input id="displayName" value={form.displayName} onChange={set("displayName")} aria-invalid={!!errors.displayName} />
                <FieldError>{errors.displayName}</FieldError>
              </Field>
              <Field data-invalid={!!errors.familyName}>
                <FieldLabel htmlFor="familyName">Family name</FieldLabel>
                <Input id="familyName" placeholder="e.g. The Smiths" value={form.familyName} onChange={set("familyName")} aria-invalid={!!errors.familyName} />
                <FieldError>{errors.familyName}</FieldError>
              </Field>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} />
                <FieldError>{errors.email}</FieldError>
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} aria-invalid={!!errors.password} />
                <FieldError>{errors.password}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
