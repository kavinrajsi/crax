import test from "node:test"
import assert from "node:assert/strict"

import { extractDomain, domainToCompanyName } from "../src/lib/email-domains.js"

/**
 * extractDomain decides which contacts get auto-linked to a company. A
 * regression here does not throw — it silently creates a "Gmail" company and
 * links every personal address to it.
 */

test("extractDomain: a business address yields its domain", () => {
  assert.equal(extractDomain("someone@madarth.com"), "madarth.com")
  assert.equal(extractDomain("someone@sub.example.co.uk"), "sub.example.co.uk")
})

test("extractDomain: normalises case and surrounding whitespace", () => {
  assert.equal(extractDomain("  Someone@Madarth.COM  "), "madarth.com")
})

test("extractDomain: personal providers are skipped", () => {
  for (const domain of [
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "hotmail.com",
    "outlook.com", "live.com", "icloud.com", "me.com", "aol.com",
    "protonmail.com", "proton.me", "rediffmail.com", "yandex.ru", "mail.ru",
    "fastmail.com", "hey.com", "duck.com", "gmx.net",
  ]) {
    assert.equal(extractDomain(`user@${domain}`), null, `${domain} should be skipped`)
  }
})

test("extractDomain: personal-provider matching is case-insensitive", () => {
  assert.equal(extractDomain("User@GMAIL.com"), null)
})

test("extractDomain: rejects anything that is not one address", () => {
  assert.equal(extractDomain(null), null)
  assert.equal(extractDomain(undefined), null)
  assert.equal(extractDomain(""), null)
  assert.equal(extractDomain("no-at-sign"), null)
  assert.equal(extractDomain("two@at@signs.com"), null)
  // No dot means no registrable domain.
  assert.equal(extractDomain("user@localhost"), null)
})

test("extractDomain: a lookalike of a personal domain is still a business one", () => {
  // Substring matching would wrongly skip these; the Set is an exact match.
  assert.equal(extractDomain("user@notgmail.com"), "notgmail.com")
  assert.equal(extractDomain("user@gmail.com.co"), "gmail.com.co")
})

test("domainToCompanyName: hyphens become spaces, words are capitalised", () => {
  assert.equal(domainToCompanyName("my-company.io"), "My Company")
  assert.equal(domainToCompanyName("madarth.com"), "Madarth")
  assert.equal(domainToCompanyName("acme-widgets-ltd.co.uk"), "Acme Widgets Ltd")
})
