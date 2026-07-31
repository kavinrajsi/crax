import { Skeleton } from "@/components/ui/skeleton"
import { PageHeading } from "@/components/skeletons"

/**
 * Fallback for any route in this group that has no loading.js of its own.
 * Every current route has one, so this normally never renders — it exists so
 * that adding a route doesn't silently reintroduce the "click, nothing happens
 * until the query returns" gap.
 *
 * Deliberately resembles no particular page: a shape that half-matches causes
 * more visible reflow than a neutral block. Route-specific skeletons belong in
 * the route's own loading.js.
 *
 * The root src/app/loading.js does not cover this case — Next will not unmount
 * a shared layout to show an ancestor fallback.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
