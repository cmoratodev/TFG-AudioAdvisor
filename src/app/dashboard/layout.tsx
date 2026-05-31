import type { Metadata } from 'next'

/**
 * Per-route layout so a Client Component page can still ship its own
 * `<title>` / `<meta description>` — page-level `metadata` exports aren't
 * allowed alongside `'use client'`.
 */
export const metadata: Metadata = {
  title: 'Subir pista',
  description: 'Sube una nueva pista a Audio Advisor para recibir feedback técnico anclado al segundo.',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
