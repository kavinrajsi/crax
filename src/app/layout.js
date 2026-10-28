import { DM_Sans } from "next/font/google"
import { NeonAuthProvider } from "@/components/neon-auth-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
})

export const metadata = {
  title: "Crax",
  description: "Crax app",
}

/* viewportFit cover lets the fixed mobile tab bar sit over the home-indicator
   area; the tab bar pads itself with env(safe-area-inset-bottom). */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <NeonAuthProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </NeonAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
