import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/AppShell'

const jakarta     = Plus_Jakarta_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-jakarta' })
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400','500','700'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Bionordi CRM',
  icons: {
    icon: '/LOGO_CRM_BIONORDI_OG.png',
    shortcut: '/LOGO_CRM_BIONORDI_OG.png',
    apple: '/LOGO_CRM_BIONORDI_OG.png',
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${jakarta.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <body className="flex h-[100dvh] overflow-hidden bg-gradient-to-br from-[#E5ECF6] to-[#F4F7FB] text-[#1E293B] font-sans antialiased">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
