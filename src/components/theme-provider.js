"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/* Class-based dark mode, following the OS by default. The `.dark` token block
   in globals.css and every `dark:` utility key off the class this sets. */
export function ThemeProvider({ children }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
