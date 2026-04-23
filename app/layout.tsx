import type { Metadata } from 'next'
import { Inter, Outfit, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import SidebarNav from '@/components/SidebarNav'

const inter      = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit     = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400','500','700'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Bionordi CRM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable} ${ibmPlexMono.variable}`}>
      <body className="flex h-screen overflow-hidden bg-gradient-to-br from-[#E5ECF6] to-[#F4F7FB] text-[#1E293B] font-sans antialiased">
        <SidebarNav />
        <main className="flex-1 flex flex-col h-full pl-0 pr-10 py-8 overflow-hidden relative">
          {children}
        </main>
      </body>
    </html>
  )
}
