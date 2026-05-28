import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL)

// Internal/test emails excluded from all production views
export const EXCLUDED_EMAILS = [
  "kavin@madarth.com",
  "sikavinraj@gmail.com",
  "kavinrajsi01@gmail.com",
]
