"use client"

import { useState, useTransition, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { disconnectFacebookPage } from "@/app/(app)/profile/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircleIcon, AlertCircleIcon, Link2Icon, XIcon } from "lucide-react"
import { formatDate } from "@/lib/table-utils"

function initials(name) {
  return (name || "U")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
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

  async function handleSubmit(e) {
    e.preventDefault()
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
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
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

  async function handleSendReset(e) {
    e.preventDefault()
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
            <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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

const FB_ERROR_MESSAGES = {
  state: "Connection request expired or could not be verified — try again.",
  denied: "Facebook did not return an authorization code — the request may have been cancelled.",
  exchange: "Could not complete the connection with Facebook. Try again in a moment.",
}

function IntegrationsTab({ connections }) {
  const searchParams = useSearchParams()
  const fbConnected = searchParams.get("fb_connected")
  const fbError = searchParams.get("fb_error")
  const [isPending, startTransition] = useTransition()
  const [removingId, setRemovingId] = useState(null)

  function handleDisconnect(pageId) {
    setRemovingId(pageId)
    startTransition(async () => {
      await disconnectFacebookPage(pageId)
      setRemovingId(null)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Connect Facebook Pages to pull Lead Ads submissions automatically.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {fbConnected != null && (
          <Alert>
            <CheckCircleIcon className="h-4 w-4" />
            <AlertDescription>
              {Number(fbConnected) > 0
                ? `Connected ${fbConnected} Facebook Page${Number(fbConnected) === 1 ? "" : "s"}.`
                : "Signed in with Facebook, but no Pages were found for this account."}
            </AlertDescription>
          </Alert>
        )}
        {fbError && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>{FB_ERROR_MESSAGES[fbError] ?? "Could not connect Facebook."}</AlertDescription>
          </Alert>
        )}

        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Facebook Pages connected yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {connections.map((c) => (
              <div key={c.page_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{c.page_name}</span>
                  <span className="text-xs text-muted-foreground">Connected {formatDate(c.created_at, { compact: true })}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending && removingId === c.page_id}
                  onClick={() => handleDisconnect(c.page_id)}
                  className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  {isPending && removingId === c.page_id ? "Disconnecting…" : "Disconnect"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button render={<a href="/api/facebook/oauth/start" />} size="sm" className="gap-1.5">
          <Link2Icon className="h-3.5 w-3.5" />
          Connect Facebook
        </Button>
      </CardFooter>
    </Card>
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

export function ProfileClient({ initialName, initialEmail, connections = [] }) {
  const displayName = initialName || initialEmail || "User"

  return (
    <div className="flex flex-col gap-6">
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
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="account">
            <AccountTab initialName={initialName} initialEmail={initialEmail} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab initialEmail={initialEmail} />
          </TabsContent>
          <TabsContent value="integrations">
            <Suspense fallback={null}>
              <IntegrationsTab connections={connections} />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
