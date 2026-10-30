import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * One phone row. Title with badge at the right, a subtitle, then a meta row of
 * small facts. `actions` sit below a divider, so a tap on a button never nests
 * inside the link that makes the card tappable.
 *
 * `href` makes the whole top section a link (chevron shown). Without it the card
 * is static, unless `onClick` is given.
 */
export function ListCard({ href, onClick, title, badge, subtitle, meta = [], actions }) {
  const body = (
    <>
      <div className="flex min-h-10 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{title || "—"}</div>
          {subtitle && <div className="truncate text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge}
          {(href || onClick) && <ChevronRightIcon className="size-4 text-muted-foreground" />}
        </div>
      </div>
      {meta.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {meta.filter(Boolean).map((item, index) => (
            <span key={index} className="tabular-nums">{item}</span>
          ))}
        </div>
      )}
    </>
  )

  const interactive = Boolean(href || onClick)
  return (
    <div className={cn("rounded-2xl border bg-card p-4 text-card-foreground", interactive && "transition-colors active:bg-muted/50")}>
      {href ? (
        <Link href={href} className="block">{body}</Link>
      ) : onClick ? (
        <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => event.key === "Enter" && onClick()} className="block cursor-pointer">
          {body}
        </div>
      ) : (
        body
      )}
      {actions && <div className="mt-2 flex flex-wrap gap-2 border-t pt-2">{actions}</div>}
    </div>
  )
}
