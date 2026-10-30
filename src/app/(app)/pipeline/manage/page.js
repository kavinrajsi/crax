import { redirect } from "next/navigation"

/* Moved to Settings → Pipelines. Kept so old links still land somewhere. */
export default function ManagePipelinesPage() {
  redirect("/settings")
}
