"use client"

import { NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react"
import { authClient } from "@/lib/auth-client"

export function NeonAuthProvider({ children }) {
  return (
    <NeonAuthUIProvider authClient={authClient}>
      {children}
    </NeonAuthUIProvider>
  )
}
