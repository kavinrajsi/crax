// Client-safe (uses only NEXT_PUBLIC_ vars)
export const isAuthConfigured = !!(
  process.env.NEXT_PUBLIC_STACK_PROJECT_ID &&
  process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
)
