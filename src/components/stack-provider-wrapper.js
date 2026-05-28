"use client"

import { StackProvider, StackTheme } from "@stackframe/stack"

export function StackProviderWrapper({ app, children }) {
  if (!app) return <>{children}</>
  return (
    <StackProvider app={app}>
      <StackTheme>{children}</StackTheme>
    </StackProvider>
  )
}
