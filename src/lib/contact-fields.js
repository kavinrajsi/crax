import {
  MailIcon,
  PhoneIcon,
  BuildingIcon,
  BriefcaseIcon,
  MessageSquareIcon,
  TagIcon,
  GlobeIcon,
  MegaphoneIcon,
  MousePointerClickIcon,
  MapPinIcon,
  NetworkIcon,
  CalendarIcon,
  BracesIcon,
  UserIcon,
} from "lucide-react"

/**
 * Every displayable column on public.contact_us, in one place.
 *
 * Both the detail page and the /data row drawer render from this list, so they
 * cannot drift apart the way they had — the drawer was showing 8 of 25 columns
 * and `message` was rendered nowhere in the app at all, despite 91 of 121
 * contacts having one.
 *
 * Deliberately NOT "use client": contacts/[id]/page.js is a server component,
 * and a "use client" module's exports would arrive there as client references
 * rather than values. Same constraint documented in src/lib/table-utils.js.
 *
 * Columns intentionally absent, because they are not plain read-only fields:
 *   id          → the "Contact #{id}" subtitle
 *   name        → the <h1>
 *   status      → <ContactStatusSelect>, an editable control
 *   company_id  → <ContactCompanySelect>, an editable control
 * Everything else on the table appears below. If you add a column, add it here —
 * the script that used to fail when you forgot was deleted on 2026-08-01, so a
 * missing column now just renders nowhere, silently. That is exactly how
 * `message` went unrendered while 91 of 121 contacts had one.
 */

/**
 * kind drives rendering:
 *   text (default) · url · date · array · json
 * wide: true spans the full grid row (long-form content).
 */
export const CONTACT_FIELD_GROUPS = [
  {
    title: "Contact",
    fields: [
      { key: "email", label: "Email", icon: MailIcon, breakAll: true },
      { key: "phone", label: "Phone", icon: PhoneIcon },
      { key: "role", label: "Role", icon: BriefcaseIcon },
      { key: "company", label: "Company", icon: BuildingIcon },
    ],
  },
  {
    title: "Enquiry",
    fields: [
      { key: "message", label: "Message", icon: MessageSquareIcon, wide: true, kind: "longtext" },
      { key: "needs", label: "Needs", icon: TagIcon, kind: "array" },
    ],
  },
  {
    title: "Attribution",
    fields: [
      { key: "source_url", label: "Source", icon: GlobeIcon, kind: "url" },
      { key: "utm_source", label: "UTM Source", icon: MegaphoneIcon },
      { key: "utm_medium", label: "UTM Medium", icon: MegaphoneIcon },
      { key: "utm_campaign", label: "UTM Campaign", icon: MegaphoneIcon },
      { key: "utm_term", label: "UTM Term", icon: MegaphoneIcon },
      { key: "utm_content", label: "UTM Content", icon: MegaphoneIcon },
      { key: "gclid", label: "gclid", icon: MousePointerClickIcon, breakAll: true },
      { key: "wbraid", label: "wbraid", icon: MousePointerClickIcon, breakAll: true },
      { key: "gbraid", label: "gbraid", icon: MousePointerClickIcon, breakAll: true },
      { key: "fbclid", label: "fbclid", icon: MousePointerClickIcon, breakAll: true },
      { key: "msclkid", label: "msclkid", icon: MousePointerClickIcon, breakAll: true },
    ],
  },
  {
    /* Where the lead landed, not who claimed it. Leads arrive from the website,
       so there is no owner at source; the column defaults to business@madarth.com
       in the live database, the shared inbox, and every row currently reads
       that. It is a label, not a workflow — nothing in the app reassigns it and
       no assignment control is planned, so "Owner" alone would overstate what
       the value means.

       Kept visible rather than moved to HANDLED_ELSEWHERE because the column
       now always holds a value, and a populated column rendered nowhere is the
       failure that left `message` invisible on 91 of 121 contacts. */
    title: "Assignment",
    fields: [
      { key: "owner_email", label: "Inbox", icon: UserIcon, breakAll: true },
    ],
  },
  {
    title: "Request",
    fields: [
      { key: "ip_address", label: "IP Address", icon: NetworkIcon },
      { key: "location", label: "Location", icon: MapPinIcon },
      { key: "created_at", label: "Submitted", icon: CalendarIcon, kind: "date" },
      { key: "raw_payload", label: "Raw Payload", icon: BracesIcon, wide: true, kind: "json" },
    ],
  },
]

/** Columns rendered by a dedicated control rather than a generic field. */
export const HANDLED_ELSEWHERE = ["id", "name", "status", "company_id"]

/** Flat list, for tests and for surfaces that don't want the grouping. */
export const CONTACT_FIELDS = CONTACT_FIELD_GROUPS.flatMap((group) => group.fields)

/** True when the value should render as the em-dash placeholder. */
export function isBlank(value) {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  // Before the generic object branch. @neondatabase/serverless returns
  // timestamptz as a Date, and `Object.keys(new Date())` is [] — so every
  // kind:"date" field (created_at, "Submitted") rendered as an em-dash on both
  // the detail page and the /data drawer. Only an unparseable date is blank.
  if (value instanceof Date) return Number.isNaN(value.getTime())
  if (typeof value === "object") return Object.keys(value).length === 0
  return String(value).trim() === ""
}
