import { Geist, Geist_Mono } from "next/font/google"
import { NeonAuthProvider } from "@/components/neon-auth-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata = {
  title: "Crax",
  description: "Crax app",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <NeonAuthProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </NeonAuthProvider>
      </body>
    </html>
  )
}
