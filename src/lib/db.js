import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL)

export function getCompanyOptions() {
  return sql`SELECT id, name FROM public.companies ORDER BY name ASC`
}
