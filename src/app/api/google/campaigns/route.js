import { getUserOrNull } from "@/lib/dal"
import { fetchCampaignPerformance } from "@/lib/google-ads"

export async function GET() {
  if (!(await getUserOrNull())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { configured, campaigns } = await fetchCampaignPerformance()
    return Response.json({ configured, campaigns })
  } catch (error) {
    console.error("[google-campaigns] fetch failed", { error })
    return Response.json({ error: "Could not fetch campaign data" }, { status: 500 })
  }
}
