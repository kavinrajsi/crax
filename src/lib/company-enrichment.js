import { sql } from "@/lib/db"
import { extractDomain, domainToCompanyName } from "@/lib/email-domains"

/**
 * Company auto-linking. The pure domain helpers this depends on live in
 * `@/lib/email-domains` so they can be unit-tested without a database handle.
 */

/**
 * How long to wait for a domain to answer before treating it as dead.
 *
 * Two attempts at this each, so the worst case is twice this number — and that
 * worst case is paid by the public intake webhook, which the website's form is
 * waiting on. Measured against a real typo domain from the data (gmmail.com,
 * which black-holes rather than refusing), 5s per attempt meant a 10s response.
 * 2.5s caps it at 5s. A slow-but-real site loses its automatic link and can
 * still be linked by hand.
 */
const REACHABILITY_TIMEOUT_MS = 2500

/**
 * Does this domain actually serve a site?
 *
 * Guards company CREATION only. Without it the table fills with companies
 * invented from typos and spam: the live data already contains gmmail.com
 * (a gmail typo), test.com, example.com and jmailservice.com — the last on
 * seven separate leads. A domain that answers is weak evidence of a real
 * business, but a domain that answers nothing is strong evidence against one.
 *
 * Deliberately conservative in every failure mode. DNS failure, timeout,
 * connection refused, TLS error and any non-2xx all return false, so the
 * caller does nothing. A real company whose site is briefly down is skipped
 * rather than guessed at, which is recoverable — a human can still link it by
 * hand. A junk company created automatically is not: it persists, and someone
 * has to notice and delete it.
 *
 * Redirects are followed, because https://domain → https://www.domain is the
 * normal shape and the redirect itself says nothing about whether a business
 * exists there.
 */
async function isDomainLive(domain) {
  const attempt = async (method) => {
    const response = await fetch(`https://${domain}`, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
    })
    return response.ok
  }

  try {
    return await attempt("HEAD")
  } catch {
    /* Plenty of servers answer HEAD with 405 or hang up on it while serving GET
       normally, so one retry before writing the domain off. Anything thrown
       here — DNS, timeout, TLS — is the answer we want: no. */
    try {
      return await attempt("GET")
    } catch {
      return false
    }
  }
}

/**
 * Auto-link a contact to a company.
 *
 * Two ways a company can be identified, and they are NOT equally safe:
 *
 *   by domain — the email's domain, personal providers excluded. Evidence the
 *     sender could not fake by typing, so this runs unattended at intake. A
 *     domain that has no company yet must answer over HTTPS before one is
 *     created for it (see isDomainLive) — otherwise nothing happens at all.
 *
 *   by name — whatever the lead typed into the form's company field. Only ever
 *     used when `allowNameFallback` is set, which is the human-initiated path
 *     (detectAndLinkCompany). Left off at intake deliberately: the typed value
 *     is unvalidated free text, and auto-creating a company per distinct string
 *     would fill the table with junk. Of the 85 visible leads, 23 have a typed
 *     company name and a personal email — real cases this recovers, but each
 *     wants a human looking at it.
 *
 * @param {number} contactId
 * @param {string|null} email
 * @param {string|null} companyName  the form's company field
 * @param {{ overwrite?: boolean, allowNameFallback?: boolean }} opts
 *        overwrite — re-link even if already linked
 *        allowNameFallback — permit matching on the typed name when the email
 *                            domain yields nothing. Off by default.
 * @returns {{ companyId: number, companyName: string, created: boolean,
 *             matchedBy: "domain"|"name" } | null}
 */
export async function autoLinkCompany(
  contactId,
  email,
  companyName,
  { overwrite = false, allowNameFallback = false } = {}
) {
  const domain = extractDomain(email)
  const typedName = companyName?.trim() || null

  /* Nothing to go on. Previously this returned here whenever the domain was
     personal, discarding the typed name without ever looking at it — so the
     lead most likely to need help (gmail address, company written out by hand)
     was the one guaranteed to be skipped. */
  if (!domain && !(allowNameFallback && typedName)) return null

  // Skip if already linked (unless overwrite requested)
  if (!overwrite) {
    const [contact] = await sql`SELECT company_id FROM public.contact_us WHERE id = ${contactId}`
    if (contact?.company_id) return null
  }

  const website = domain ? `https://${domain}` : null

  /* Match on the domain when there is one, otherwise on the typed name.
     Name matching is case-insensitive and trimmed — "Crocs, Inc." and
     "crocs, inc." are one company. It is still exact beyond that: no fuzzy
     matching, so "Crocs Inc" stays separate. Merging near-duplicates is a
     judgement call for whoever is reviewing, not for this function. */
  const [existing] = domain
    ? await sql`
        SELECT id, name FROM public.companies
        WHERE website = ${website} OR website = ${`https://www.${domain}`}
        LIMIT 1
      `
    : await sql`
        SELECT id, name FROM public.companies
        WHERE lower(trim(name)) = ${typedName.toLowerCase()}
        LIMIT 1
      `

  let companyId
  let resolvedName
  let created = false

  if (existing) {
    companyId    = existing.id
    resolvedName = existing.name
  } else {
    /* Creating, not matching — so the domain has to prove it exists first. Only
       reached when there is no company for it yet, so this costs one request
       per genuinely new domain rather than one per lead. An unreachable domain
       links nothing at all: better a contact left unlinked, which a human can
       fix, than a junk company nobody notices. */
    if (domain && !(await isDomainLive(domain))) return null

    resolvedName = typedName || domainToCompanyName(domain)
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

  return { companyId, companyName: resolvedName, created, matchedBy: domain ? "domain" : "name" }
}
