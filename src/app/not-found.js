import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * Catches `notFound()` from contacts/[id] and companies/[id], plus any unknown
 * URL. Both of those called notFound() with nothing to catch it.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 text-center p-6">
      <p className="font-heading text-5xl font-semibold text-muted-foreground/40">404</p>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">Not found</h1>
        <p className="text-sm text-muted-foreground">
          That page doesn&apos;t exist, or the record was deleted.
        </p>
      </div>
      <Button size="sm" render={<Link href="/dashboard" />} nativeButton={false}>
        Back to dashboard
      </Button>
    </div>
  )
}
