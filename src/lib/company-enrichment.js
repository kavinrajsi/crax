import { sql } from "@/lib/db"

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
function domainToCompanyName(domain) {
  const base = domain.split(".")[0]
  return base
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Auto-link a contact to a company based on their email domain.
 *
 * Logic:
 * 1. Extract domain from email (skip personal providers)
 * 2. Look for existing company with matching website
 * 3. If found → link contact
 * 4. If not found → create company then link
 *
 * @param {number} contactId
 * @param {string|null} email
 * @param {string|null} companyName - used as company name if creating new
 * @param {{ overwrite?: boolean }} opts - overwrite=true will re-link even if already linked
 * @returns {{ companyId: number, companyName: string, created: boolean } | null}
 */
export async function autoLinkCompany(contactId, email, companyName, { overwrite = false } = {}) {
  const domain = extractDomain(email)
  if (!domain) return null

  // Skip if already linked (unless overwrite requested)
  if (!overwrite) {
    const [contact] = await sql`SELECT company_id FROM public.contact_us WHERE id = ${contactId}`
    if (contact?.company_id) return null
  }

  const website = `https://${domain}`

  // Check if a company with this domain already exists
  const [existing] = await sql`
    SELECT id, name FROM public.companies
    WHERE website = ${website} OR website = ${`https://www.${domain}`}
    LIMIT 1
  `

  let companyId
  let resolvedName
  let created = false

  if (existing) {
    companyId    = existing.id
    resolvedName = existing.name
  } else {
    resolvedName = companyName?.trim() || domainToCompanyName(domain)
    const [newCompany] = await sql`
      INSERT INTO public.companies (name, website)
      VALUES (${resolvedName}, ${website})
      RETURNING id, name
    `
    companyId    = newCompany.id
    resolvedName = newCompany.name
    created      = true
  }

  // Link the contact
  await sql`UPDATE public.contact_us SET company_id = ${companyId} WHERE id = ${contactId}`

  return { companyId, companyName: resolvedName, created }
}
