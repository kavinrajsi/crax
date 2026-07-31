"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircleIcon, CheckCircleIcon } from "lucide-react"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [form, setForm] = useState({ password: "", confirm: "" })
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  function update(field) {
    return (e) => setForm((p) => ({ ...p, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return }
    if (!token) { setError("Invalid or missing reset token. Request a new link."); return }
    setLoading(true)
    try {
      const { error: err } = await authClient.resetPassword({ newPassword: form.password, token })
      if (err) { setError(err.message ?? "Could not reset password.") } else { setDone(true) }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-2">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <CheckCircleIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">Password updated successfully.</p>
        <Button onClick={() => router.push("/login")}>Sign in</Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={update("password")} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" type="password" placeholder="••••••••" value={form.confirm} onChange={update("confirm")} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Updating…" : "Update password"}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Set a new password</CardTitle>
        <CardDescription>Choose a strong password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
