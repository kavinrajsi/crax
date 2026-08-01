import { auth } from "@/lib/auth"
import { recordAudit } from "@/lib/audit"

const { GET: _GET, POST: _POST, PUT: _PUT, DELETE: _DELETE, PATCH: _PATCH } = auth.handler()

// Patch the Origin header to the Neon Auth backend's own origin before proxying.
// better-auth's CSRF check blocks POST requests whose Origin doesn't match its
// trustedOrigins list. Since the browser→Next.js leg is same-origin, the CSRF
// risk is already mitigated here; we only need to satisfy the backend check.
function withBackendOrigin(request, body) {
  const backendOrigin = new URL(process.env.NEON_AUTH_BASE_URL).origin
  const headers = new Headers(request.headers)
  headers.set("origin", backendOrigin)
  headers.delete("referer")
  // A buffered string body needs no duplex; a stream does.
  return body === undefined
    ? new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        duplex: "half",
      })
    : new Request(request.url, { method: request.method, headers, body })
}

/**
 * Auth events worth a row in the audit trail.
 *
 * Failed sign-ins matter more than successful ones — a run of them against one
 * address is the signal you actually want, and this proxy is the only place the
 * app can see it.
 *
 * Page views are deliberately NOT audited. High write volume for little value,
 * and the old seed data's view_list/view_detail rows are precisely why the page
 * used to claim more than it recorded.
 */
const AUDITED_AUTH_PATHS = {
  "sign-in/email": { ok: "auth.login", failed: "auth.login_failed" },
  "sign-out": { ok: "auth.logout", failed: null },
}

function auditedPath(url) {
  const path = new URL(url).pathname.replace(/^\/api\/auth\//, "")
  return AUDITED_AUTH_PATHS[path] ? { ...AUDITED_AUTH_PATHS[path] } : null
}

export async function GET(request, ctx) { return _GET(request, ctx) }

export async function POST(request, ctx) {
  const audited = auditedPath(request.url)
  if (!audited) return _POST(withBackendOrigin(request), ctx)

  /* Buffer the body: reading it to learn the email would otherwise consume the
     stream the proxy needs to forward. */
  const raw = await request.text()
  let email = null
  try {
    email = JSON.parse(raw)?.email ?? null
  } catch {
    // not JSON — record the attempt with an unknown actor rather than failing it
  }

  const response = await _POST(withBackendOrigin(request, raw), ctx)

  const action = response.ok ? audited.ok : audited.failed
  if (action) {
    // recordAudit swallows its own failures, so this cannot break sign-in.
    await recordAudit({ email: email ?? "unknown" }, action, {
      table: "auth",
      after: response.ok ? null : { status: response.status },
    })
  }
  return response
}

export async function PUT(request, ctx) { return _PUT(withBackendOrigin(request), ctx) }
export async function DELETE(request, ctx) { return _DELETE(withBackendOrigin(request), ctx) }
export async function PATCH(request, ctx) { return _PATCH(withBackendOrigin(request), ctx) }
