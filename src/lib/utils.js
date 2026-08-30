import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a URL safe to put in an href, or undefined if its scheme isn't on the
 * allowlist. contact.source_url and company.website are attacker-controlled
 * (written verbatim by the unauthenticated intake and by user forms with only
 * client-side validation), so rendering them as links without a scheme check
 * lets javascript:/data:/vbscript: URLs through. React warns on some of these
 * but does not block them, and any render path without target="_blank" would
 * make it live stored XSS. A bare host like "example.com" is treated as https.
 */
const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"])

export function safeHref(value) {
  if (!value) return undefined
  const raw = String(value).trim()
  if (!raw) return undefined
  // No scheme and no leading slash → assume https (covers "example.com").
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//") ? raw : `https://${raw}`
  try {
    const url = new URL(candidate, "https://placeholder.invalid")
    return SAFE_URL_SCHEMES.has(url.protocol) ? candidate : undefined
  } catch {
    return undefined
  }
}
