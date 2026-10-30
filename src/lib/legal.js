/**
 * Operator details shown on every policy page. Fill the bracketed values once
 * here; every page reads from this file.
 */
export const LEGAL = {
  appName: "Crax",
  companyName: "[Company legal name]",
  contactEmail: "[privacy contact email]",
  address: "[registered business address]",
  jurisdiction: "[governing law and jurisdiction]",
  updated: "30 October 2026",
}

export const POLICIES = [
  { href: "/privacy", label: "Privacy Policy", summary: "What personal data Crax collects and how it is used." },
  { href: "/terms", label: "Terms of Service", summary: "The rules for using Crax." },
  { href: "/cookies", label: "Cookie Policy", summary: "The cookies and similar storage Crax uses." },
  { href: "/acceptable-use", label: "Acceptable Use Policy", summary: "What you may not do with Crax." },
  { href: "/data-retention", label: "Data Retention Policy", summary: "How long different data is kept." },
  { href: "/refund", label: "Refund Policy", summary: "How refunds and cancellations are handled." },
]
