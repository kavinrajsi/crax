/**
 * Competitor data for /compare-crm. Descriptions are general positioning, not
 * live pricing or feature checks: verify each vendor before publishing changes.
 */
export const COMPARE_CHECKED = "30 October 2026"

export const CRAX_FEATURES = [
  "Custom pipelines and stages",
  "Per-user colour tags",
  "Timeline notes with author-only editing",
  "Audit log of every change",
  "CSV import and export",
  "Public lead intake API",
  "Dashboard and status analytics",
  "Phone-friendly layout",
]

/* `has` lists the Crax features that are built. `note` says where it is weaker. */
export const COMPETITORS = [
  {
    name: "Spreadsheets",
    bestFor: "A quick list for one person with a handful of leads.",
    choose: "You have very few contacts and no need for history, roles or reporting.",
    limits: "No audit trail, no timeline, duplicates and stale data creep in, and sharing becomes messy.",
  },
  {
    name: "Pipedrive",
    bestFor: "Sales teams that live in a deal pipeline.",
    choose: "Pipeline-first selling is the core of your process.",
    limits: "Pricing rises with seats and add-ons; not built around custom pipeline stages per team.",
  },
  {
    name: "HubSpot",
    bestFor: "Companies that want marketing, sales and service in one suite.",
    choose: "You need marketing automation and a broad free tier alongside the CRM.",
    limits: "Broad suite, so more to configure; costs grow as you add hubs and contacts.",
  },
  {
    name: "monday.com",
    bestFor: "Teams that run projects and CRM on one work-management board.",
    choose: "Your CRM is one part of wider project tracking.",
    limits: "A work-management tool first; sales-specific reporting is less deep than a dedicated CRM.",
  },
  {
    name: "Insightly",
    bestFor: "Small businesses that want CRM plus project tracking.",
    choose: "You want contacts, opportunities and projects linked together.",
    limits: "Interface and integrations are less modern than newer tools.",
  },
  {
    name: "Act! CRM",
    bestFor: "Small businesses that have used Act! for years.",
    choose: "You rely on existing Act! data, desktop workflows or its marketing tools.",
    limits: "Heavier setup and an older interface than cloud-first tools.",
  },
  {
    name: "Copper",
    bestFor: "Teams that run on Google Workspace.",
    choose: "Gmail and Google Calendar are where your sales work happens.",
    limits: "Built around Google Workspace; less useful if your team is on other email systems.",
  },
  {
    name: "Capsule",
    bestFor: "Small businesses that want a simple, low-cost CRM.",
    choose: "You want contacts, tasks and a basic pipeline without heavy configuration.",
    limits: "Fewer advanced customisation and reporting options.",
  },
  {
    name: "Close CRM",
    bestFor: "Inside sales teams that call and email a lot.",
    choose: "Calling, email sequences and activity tracking are central to your team.",
    limits: "Built for high-volume outbound; a simpler team may not need that depth.",
  },
  {
    name: "Attio",
    bestFor: "Teams that want a flexible, relationship-style data model.",
    choose: "You want to model your own objects and relationships.",
    limits: "Flexibility means more setup decisions up front.",
  },
  {
    name: "Zoho Bigin",
    bestFor: "Small businesses already using the Zoho suite.",
    choose: "You want an affordable pipeline CRM that connects to other Zoho apps.",
    limits: "Most value comes from staying inside the Zoho ecosystem.",
  },
]

/* Feature matrix, in the style of an edition comparison table.
   Values: "yes" | "no" | "limited" | "verify" (not yet checked against the vendor). */
export const MATRIX_TOOLS = ["Crax", "Spreadsheets", "Pipedrive", "HubSpot", "monday.com", "Insightly", "Act! CRM", "Copper", "Capsule", "Close CRM", "Attio", "Zoho Bigin"]

export const MATRIX_GROUPS = [
  {
    title: "Sales",
    rows: [
      { label: "Custom pipelines and stages", values: ["yes", "no", "yes", "yes", "yes", "verify", "verify", "verify", "verify", "verify", "verify", "yes"] },
      { label: "Contact and company records", values: ["yes", "yes", "yes", "yes", "yes", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
      { label: "Deal tracking", values: ["yes", "limited", "yes", "yes", "yes", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
    ],
  },
  {
    title: "Automation",
    rows: [
      { label: "Email sync", values: ["no", "no", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
      { label: "Workflow automation", values: ["no", "limited", "verify", "yes", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
    ],
  },
  {
    title: "Analytics",
    rows: [
      { label: "Dashboards and reports", values: ["yes", "limited", "verify", "yes", "yes", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
    ],
  },
  {
    title: "Collaboration and records",
    rows: [
      { label: "Timeline notes", values: ["yes", "no", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
      { label: "Audit log of changes", values: ["yes", "limited", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
    ],
  },
  {
    title: "Data and integrations",
    rows: [
      { label: "CSV import and export", values: ["yes", "yes", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
      { label: "Public lead intake API", values: ["yes", "no", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
    ],
  },
  {
    title: "Access and pricing",
    rows: [
      { label: "Mobile app", values: ["no", "limited", "yes", "yes", "yes", "verify", "verify", "verify", "verify", "verify", "verify", "verify"] },
      { label: "Free plan", values: ["verify", "yes", "verify", "yes", "verify", "verify", "verify", "verify", "verify", "verify", "verify", "yes"] },
    ],
  },
]
