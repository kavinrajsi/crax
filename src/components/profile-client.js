"use client"

import { useState, useTransition, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { disconnectFacebookPage, disconnectLinkedInAccount } from "@/app/(app)/profile/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FacebookBackfillCard } from "@/components/lead-backfill"
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

/* One card per lead-source provider. `items` rows must be pre-shaped to
   {id, name, created_at} — the DB column names differ per provider
   (page_id/page_name vs account_urn/account_name) and the server component
   normalizes them so this stays dumb. */
function ProviderConnectionsCard({ provider, itemNoun, description, connectHref, items, onDisconnect, connectedParam, errorParam, errorMessages }) {
  const searchParams = useSearchParams()
  const connected = searchParams.get(connectedParam)
  const error = searchParams.get(errorParam)
  const [isPending, startTransition] = useTransition()
  const [removingId, setRemovingId] = useState(null)

  function handleDisconnect(id) {
    setRemovingId(id)
    startTransition(async () => {
      await onDisconnect(id)
      setRemovingId(null)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{provider}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {connected != null && (
          <Alert>
            <CheckCircleIcon className="h-4 w-4" />
            <AlertDescription>
              {Number(connected) > 0
                ? `Connected ${connected} ${itemNoun}${Number(connected) === 1 ? "" : "s"}.`
                : `Signed in with ${provider}, but no ${itemNoun}s were found for this account.`}
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>{errorMessages[error] ?? `Could not connect ${provider}.`}</AlertDescription>
          </Alert>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {provider} {itemNoun}s connected yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">Connected {formatDate(item.created_at, { compact: true })}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending && removingId === item.id}
                  onClick={() => handleDisconnect(item.id)}
                  className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  {isPending && removingId === item.id ? "Disconnecting…" : "Disconnect"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button render={<a href={connectHref} />} size="sm" className="gap-1.5">
          <Link2Icon className="h-3.5 w-3.5" />
          Connect {provider}
        </Button>
      </CardFooter>
    </Card>
  )
}

function IntegrationsTab({ connections, linkedinConnections }) {
  return (
    <div className="flex flex-col gap-4">
      <ProviderConnectionsCard
        provider="Facebook"
        itemNoun="Page"
        description="Connect Facebook Pages to pull Lead Ads submissions automatically."
        connectHref="/api/facebook/oauth/start"
        items={connections.map((c) => ({ id: c.page_id, name: c.page_name, created_at: c.created_at }))}
        onDisconnect={disconnectFacebookPage}
        connectedParam="fb_connected"
        errorParam="fb_error"
        errorMessages={{
          state: "Connection request expired or could not be verified — try again.",
          denied: "Facebook did not return an authorization code — the request may have been cancelled.",
          exchange: "Could not complete the connection with Facebook. Try again in a moment.",
        }}
      />
      {/* Directly under the Facebook card: the backfill is only meaningful
          once a Page is connected, and the ordering makes that dependency
          read as a sequence rather than two unrelated features. */}
      {connections.length > 0 && <FacebookBackfillCard />}
      <ProviderConnectionsCard
        provider="LinkedIn"
        itemNoun="ad account"
        description="Connect LinkedIn ad accounts to pull Lead Gen Form submissions automatically. Requires approved Lead Sync API access."
        connectHref="/api/linkedin/oauth/start"
        items={linkedinConnections.map((c) => ({ id: c.account_urn, name: c.account_name, created_at: c.created_at }))}
        onDisconnect={disconnectLinkedInAccount}
        connectedParam="li_connected"
        errorParam="li_error"
        errorMessages={{
          state: "Connection request expired or could not be verified — try again.",
          denied: "LinkedIn did not return an authorization code — the request may have been cancelled.",
          exchange: "Could not complete the connection with LinkedIn. Try again in a moment.",
        }}
      />
    </div>
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

export function ProfileClient({ initialName, initialEmail, connections = [], linkedinConnections = [] }) {
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
              <IntegrationsTab connections={connections} linkedinConnections={linkedinConnections} />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
