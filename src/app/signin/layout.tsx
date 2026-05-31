import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Vuelve a tus pistas y a tu feedback en Audio Advisor.',
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
