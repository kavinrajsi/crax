"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"
import { recordAudit, snapshot } from "@/lib/audit"
import { sanitizeNoteHtml, isEmptyNoteHtml } from "@/lib/note-html"

export async function createCompany(fields) {
  const user = await requireUserOrThrow()
  const { name, industry, website, phone } = fields
  const [company] = await sql`
    INSERT INTO public.companies (name, industry, website, phone, owner_email)
    VALUES (${name}, ${industry ?? null}, ${website ?? null}, ${phone ?? null}, ${user.email})
    RETURNING *
  `
  await recordAudit(user, "company.create", { table: "companies", id: company.id, after: company })
  revalidatePath("/companies")
  return company
}

export async function updateCompany(companyId, fields) {
  const user = await requireUserOrThrow()
  const { name, industry, website, phone } = fields
  const before = await snapshot("companies", companyId)
  await sql`
    UPDATE public.companies
    SET name     = ${name},
        industry = ${industry ?? null},
        website  = ${website ?? null},
        phone    = ${phone ?? null}
    WHERE id = ${companyId}
  `
  await recordAudit(user, "company.update", {
    table: "companies", id: companyId, before, after: await snapshot("companies", companyId),
  })
  revalidatePath("/companies")
  revalidatePath(`/companies/${companyId}`)
}

export async function deleteCompany(companyId) {
  const user = await requireUserOrThrow()
  // Snapshot first — the row is gone by the time we record it.
  const before = await snapshot("companies", companyId)
  await sql`DELETE FROM public.companies WHERE id = ${companyId}`
  await recordAudit(user, "company.delete", { table: "companies", id: companyId, before })
  revalidatePath("/companies")
}

export async function linkContactToCompany(contactId, companyId) {
  const user = await requireUserOrThrow()
  const before = await snapshot("contact_us", contactId)
  await sql`
    UPDATE public.contact_us SET company_id = ${companyId ?? null} WHERE id = ${contactId}
  `
  await recordAudit(user, "contact.link_company", {
    table: "contact_us", id: contactId,
    before: before && { company_id: before.company_id },
    after: { company_id: companyId ?? null },
  })
  revalidatePath(`/contacts/${contactId}`)
  if (companyId) revalidatePath(`/companies/${companyId}`)
}

export async function addCompanyNote(companyId, body) {
  const user = await requireUserOrThrow()
  const html = sanitizeNoteHtml(body)
  if (isEmptyNoteHtml(html)) return null
  const [note] = await sql`
    INSERT INTO public.company_notes (company_id, author_email, body)
    VALUES (${companyId}, ${user.email}, ${html})
    RETURNING *
  `
  await recordAudit(user, "company.note", { table: "company_notes", id: companyId })
  revalidatePath(`/companies/${companyId}`)
  return note
}

export async function updateCompanyNote(noteId, body) {
  const user = await requireUserOrThrow()
  const html = sanitizeNoteHtml(body)
  if (isEmptyNoteHtml(html)) throw new Error("Note cannot be empty")

  const before = await snapshot("company_notes", noteId)
  if (!before) throw new Error("Note not found")
  const [note] = await sql`
    UPDATE public.company_notes SET body = ${html}, updated_at = now() WHERE id = ${noteId} RETURNING *
  `
  await recordAudit(user, "company.note_update", {
    table: "company_notes", id: noteId, before: { body: before.body }, after: { body: note.body },
  })
  revalidatePath(`/companies/${note.company_id}`)
  return note
}
