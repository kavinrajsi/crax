"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function createCompany(fields) {
  const { data: session } = await auth.getSession()
  const ownerEmail = session?.user?.email ?? "anonymous"
  const { name, industry, website, phone } = fields
  const [company] = await sql`
    INSERT INTO public.companies (name, industry, website, phone, owner_email)
    VALUES (${name}, ${industry ?? null}, ${website ?? null}, ${phone ?? null}, ${ownerEmail})
    RETURNING *
  `
  revalidatePath("/companies")
  return company
}

export async function updateCompany(companyId, fields) {
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
  await sql`DELETE FROM public.companies WHERE id = ${companyId}`
  revalidatePath("/companies")
}

export async function linkContactToCompany(contactId, companyId) {
  await sql`
    UPDATE public.contact_us SET company_id = ${companyId ?? null} WHERE id = ${contactId}
  `
  revalidatePath(`/contacts/${contactId}`)
  if (companyId) revalidatePath(`/companies/${companyId}`)
}

export async function addCompanyNote(companyId, body) {
  const trimmed = body?.trim()
  if (!trimmed) return
  const { data: session } = await auth.getSession()
  const authorEmail = session?.user?.email ?? "anonymous"
  await sql`
    INSERT INTO public.company_notes (company_id, author_email, body)
    VALUES (${companyId}, ${authorEmail}, ${trimmed})
  `
  revalidatePath(`/companies/${companyId}`)
}
