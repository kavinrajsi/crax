/** @type {import('next').NextConfig} */

/* Security response headers applied to every route.
 *
 * The CSP is deliberately conservative on the directives that can't break a
 * Next.js app — frame-ancestors (clickjacking), object-src, base-uri,
 * form-action — while leaving script/style permissive, because Next injects
 * inline bootstrap scripts and the app has no nonce pipeline yet. Tightening
 * script-src to a nonce is the follow-up; these directives are the safe,
 * high-value floor. HSTS is emitted for production over HTTPS. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
]

const nextConfig = {
  reactCompiler: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
};

export default nextConfig;
