import { sql } from "@/lib/db"
import { extractDomain, domainToCompanyName } from "@/lib/email-domains"

/**
 * Company auto-linking. The pure domain helpers this depends on live in
 * `@/lib/email-domains` so they can be unit-tested without a database handle.
 */

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
