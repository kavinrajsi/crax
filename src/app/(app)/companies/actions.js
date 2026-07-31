"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { requireUserOrThrow } from "@/lib/dal"

export async function createCompany(fields) {
  const user = await requireUserOrThrow()
  const { name, industry, website, phone } = fields
  const [company] = await sql`
    INSERT INTO public.companies (name, industry, website, phone, owner_email)
    VALUES (${name}, ${industry ?? null}, ${website ?? null}, ${phone ?? null}, ${user.email})
    RETURNING *
  `
  revalidatePath("/companies")
  return company
}

export async function updateCompany(companyId, fields) {
  await requireUserOrThrow()
  const { name, industry, website, phone } = fields
  await sql`
    UPDATE public.companies
    SET name     = ${name},
        industry = ${industry ?? null},
        website  = ${website ?? null},
        phone    = ${phone ?? null}
    WHERE id = ${companyId}
  `
  revalidatePath("/companies")
  revalidatePath(`/companies/${companyId}`)
}

export async function deleteCompany(companyId) {
  await requireUserOrThrow()
  await sql`DELETE FROM public.companies WHERE id = ${companyId}`
  revalidatePath("/companies")
}

export async function linkContactToCompany(contactId, companyId) {
  await requireUserOrThrow()
  await sql`
    UPDATE public.contact_us SET company_id = ${companyId ?? null} WHERE id = ${contactId}
  `
  revalidatePath(`/contacts/${contactId}`)
  if (companyId) revalidatePath(`/companies/${companyId}`)
}

export async function addCompanyNote(companyId, body) {
  const user = await requireUserOrThrow()
  const trimmed = body?.trim()
  if (!trimmed) return
  await sql`
    INSERT INTO public.company_notes (company_id, author_email, body)
    VALUES (${companyId}, ${user.email}, ${trimmed})
  `
  revalidatePath(`/companies/${companyId}`)
}
