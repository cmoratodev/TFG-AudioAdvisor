import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  description: 'Te enviamos un enlace para restablecer tu contraseña.',
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
