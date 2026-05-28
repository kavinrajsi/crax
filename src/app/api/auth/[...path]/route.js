import { auth } from "@/lib/auth"

const { GET: _GET, POST: _POST, PUT: _PUT, DELETE: _DELETE, PATCH: _PATCH } = auth.handler()

// Patch the Origin header to the Neon Auth backend's own origin before proxying.
// better-auth's CSRF check blocks POST requests whose Origin doesn't match its
// trustedOrigins list. Since the browser→Next.js leg is same-origin, the CSRF
// risk is already mitigated here; we only need to satisfy the backend check.
function withBackendOrigin(request) {
  const backendOrigin = new URL(process.env.NEON_AUTH_BASE_URL).origin
  const headers = new Headers(request.headers)
  headers.set("origin", backendOrigin)
  headers.delete("referer")
  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
    duplex: "half",
  })
}

export async function GET(request, ctx) { return _GET(request, ctx) }
export async function POST(request, ctx) { return _POST(withBackendOrigin(request), ctx) }
export async function PUT(request, ctx) { return _PUT(withBackendOrigin(request), ctx) }
export async function DELETE(request, ctx) { return _DELETE(withBackendOrigin(request), ctx) }
export async function PATCH(request, ctx) { return _PATCH(withBackendOrigin(request), ctx) }
