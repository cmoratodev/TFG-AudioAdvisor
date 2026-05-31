import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nueva contraseña',
  description: 'Elige una nueva contraseña para tu cuenta de Audio Advisor.',
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
