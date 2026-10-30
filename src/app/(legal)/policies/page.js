import Link from "next/link"
import { LegalDocument } from "@/components/legal-document"
import { POLICIES } from "@/lib/legal"

export const metadata = { title: "Policies · Crax" }

export default function PoliciesPage() {
  return (
    <LegalDocument title="Policies">
      <ul className="flex flex-col divide-y rounded-xl border">
        {POLICIES.map((policy) => (
          <li key={policy.href}>
            <Link href={policy.href} className="flex flex-col gap-1 p-4 hover:bg-muted/50">
              <span className="font-medium">{policy.label}</span>
              <span className="text-sm text-muted-foreground">{policy.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </LegalDocument>
  )
}
