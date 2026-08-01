/**
 * Pure email-domain helpers, split out of company-enrichment.js.
 *
 * That module opens a database handle at import time (`@/lib/db` calls
 * `neon(process.env.DATABASE_URL)`, which throws when the variable is unset),
 * so its logic could not be unit-tested without a connection string. These two
 * functions are pure and decide which contacts get linked to a company, so
 * they are the part worth testing. Keeping them here means `npm test` needs no
 * environment at all.
 */

// Common personal/free email domains — skip these for company extraction
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.uk",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.in",
  "live.com", "msn.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "protonmail.com", "proton.me", "pm.me",
  "rediffmail.com", "yandex.com", "yandex.ru", "mail.ru",
  "zohomail.com", "fastmail.com", "hey.com", "duck.com",
  "tutanota.com", "tutamail.com", "gmx.com", "gmx.net",
])

/**
 * Extract the business domain from an email address.
 * Returns null for personal email providers or invalid emails.
 */
export function extractDomain(email) {
  if (!email) return null
  const parts = email.trim().toLowerCase().split("@")
  if (parts.length !== 2) return null
  const domain = parts[1].trim()
  if (!domain.includes(".")) return null
  if (PERSONAL_DOMAINS.has(domain)) return null
  return domain
}

/**
 * Convert a domain name to a human-readable company name.
 * "my-company.io" → "My Company"
 */
export function domainToCompanyName(domain) {
  const base = domain.split(".")[0]
  return base
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
