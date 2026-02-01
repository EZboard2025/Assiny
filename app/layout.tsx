import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CompanyProvider } from '@/lib/contexts/CompanyContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ramppy - Plataforma de Treinamento',
  description: 'Centro de treinamento e desenvolvimento para vendedores',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <CompanyProvider>
          {children}
        </CompanyProvider>
      </body>
    </html>
  )
}