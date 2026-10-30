"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageShell } from "@/components/page"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { setSourceColor } from "@/app/(app)/pipeline/actions"
import { PIPELINE_SOURCES, SOURCE_DEFAULT_COLORS } from "@/lib/contact-sources"
import { CheckCircleIcon, AlertCircleIcon } from "lucide-react"

function initials(name) {
  return (name || "U")
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}

function SavedAlert() {
  return (
    <Alert>
      <CheckCircleIcon className="h-4 w-4" />
      <AlertDescription>Changes saved successfully.</AlertDescription>
    </Alert>
  )
}

function AccountTab({ initialName, initialEmail }) {
  const [name, setName] = useState(initialName)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      await authClient.updateUser({ name })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {saved && <SavedAlert />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" value={initialEmail} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function SecurityTab({ initialEmail }) {
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSendReset(event) {
    event.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { error: err } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) { setError(err.message ?? "Could not send reset link.") } else { setSent(true) }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSendReset}>
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Send a password reset link to your email.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sent && <SavedAlert />}
          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-email">Email address</Label>
            <Input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={loading || sent}>
            {loading ? "Sending…" : sent ? "Link sent" : "Send reset link"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

/* The Notifications tab was removed on 2026-08-02. It offered two email
   subscriptions over a Save button that awaited a 500ms timer, showed "Saved"
   and persisted nothing — the toggle reset on reload.

   Neither email existed. "Activity digest" advertised /api/digest, which was
   401'd on every scheduled run since it shipped and has since been deleted.
   "Security alerts" promised mail on login attempts and account changes, and
   this app has no email provider in its dependency tree at all: the only
   address it can send from belongs to Neon Auth, for password resets.

   Restore it when there is something to subscribe to and somewhere to store
   the preference. */

/* Colour for each pipeline tag (All / Madarth / Search ...). Saved per user and
   shown on the Pipeline board. */
function PipelineTab({ initialColors }) {
  const [colors, setColors] = useState(initialColors)
  const [error, setError] = useState(null)

  async function handleColor(key, color) {
    setColors((prev) => ({ ...prev, [key]: color }))
    setError(null)
    try {
      await setSourceColor(key, color)
    } catch (err) {
      console.error("[profile] tag colour save failed", err)
      setError(err.message || "Couldn't save that colour.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline tags</CardTitle>
        <CardDescription>The colour each pipeline tag shows on the Pipeline board. Saved to your account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {PIPELINE_SOURCES.map((source) => {
          const color = colors[source.key] ?? SOURCE_DEFAULT_COLORS[source.key] ?? "#64748b"
          return (
            <div key={source.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium" style={{ color }}>{source.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">{color}</span>
                <input
                  type="color"
                  value={color}
                  aria-label={`Colour for ${source.label}`}
                  onChange={(event) => handleColor(source.key, event.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-1"
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function ProfileClient({ initialName, initialEmail, sourceColors = {} }) {
  const displayName = initialName || initialEmail || "User"

  return (
    <PageShell>
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg font-semibold">{initials(displayName)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{displayName}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{initialEmail}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="account">
        {/* Phone: three equal tabs across the full width. */}
        <TabsList className="grid w-full grid-cols-3 md:inline-flex md:w-auto">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="account">
            <AccountTab initialName={initialName} initialEmail={initialEmail} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab initialEmail={initialEmail} />
          </TabsContent>
          <TabsContent value="pipeline">
            <PipelineTab initialColors={sourceColors} />
          </TabsContent>
        </div>
      </Tabs>
    </PageShell>
  )
}
