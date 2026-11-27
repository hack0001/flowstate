'use client'
import { LanguageProvider } from '@/context/LanguageContext'
import { ReactNode } from 'react'
import AppShell from '@/components/AppShell'

export function Providers({ children }: { children: ReactNode }) {
  return <LanguageProvider><AppShell>{children}</AppShell></LanguageProvider>
}
