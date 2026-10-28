import { SearchIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/* Shared page template. Every list page is: PageHeader, then CountChips,
   FilterSearch and filters, then a MobileList (phone) or DesktopTable (md up).
   Server-safe: no "use client" here, so pages can use these directly. */

export function PageShell({ children, className }) {
  return <div className={cn("flex w-full min-w-0 flex-col gap-5", className)}>{children}</div>
}

/** Title and actions. Actions wrap under the title on phones. */
export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/**
 * Stat chips. Each item: { label, count, color? }. A colour (hex) tints the chip
 * the way the pipeline status badges are tinted. Scrolls sideways on a phone
 * instead of wrapping, so it stays one line.
 */
export function CountChips({ items }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
      {items.map(({ label, count, color }) => (
        <span
          key={label}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm"
          style={color ? { backgroundColor: `${color}18`, color, borderColor: `${color}40` } : undefined}
        >
          {label}
          <span className="font-medium tabular-nums">{count}</span>
        </span>
      ))}
    </div>
  )
}

/** Full-width search. Taller on phone so the tap target is at least 40px. */
export function FilterSearch({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 pl-9 md:h-9 md:text-sm"
      />
    </div>
  )
}

/** Phone list of ListCard rows. Hidden from md up, where DesktopTable shows. */
export function MobileList({ children }) {
  return <div className="flex min-w-0 flex-col gap-2 md:hidden">{children}</div>
}

/** Table wrapper that only shows from md up. */
export function DesktopTable({ children }) {
  return <div className="hidden min-w-0 overflow-hidden rounded-xl border border-border md:block">{children}</div>
}

/** Shown in place of the list or table when nothing matches. Works at both widths. */
export function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
